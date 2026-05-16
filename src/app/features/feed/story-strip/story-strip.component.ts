import { DatePipe } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, of, switchMap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService, User } from '../../../core/services/auth.service';
import {
  CreateStoryRequest,
  MediaResponse,
  MediaService,
  Story,
  StoryMediaType
} from '../../../core/services/media.service';

interface StoryGroup {
  authorId: number;
  stories: Story[];
  latestStory: Story;
}

@Component({
  selector: 'app-story-strip',
  imports: [DatePipe, FormsModule],
  templateUrl: './story-strip.component.html',
  styleUrls: ['./story-strip.component.css']
})
export class StoryStripComponent implements OnInit, OnDestroy {
  private mediaService = inject(MediaService);
  private authService = inject(AuthService);
  private readonly fallbackUserLabel = 'User';
  private readonly mediaBaseUrl = environment.apiUrl.replace(/\/+$/, '');

  @ViewChild('storyFileInput') storyFileInput!: ElementRef<HTMLInputElement>;

  storyGroups: StoryGroup[] = [];
  storiesLoading = true;
  storiesError = false;

  currentUserId: number | null = null;
  userDisplayNames: Record<number, string> = {};

  showCreateModal = false;
  creatingStory = false;
  createStoryError = '';
  storyCaption = '';
  selectedStoryFile: File | null = null;
  selectedStoryPreviewUrl = '';

  showViewer = false;
  viewerStories: Story[] = [];
  viewerAuthorId: number | null = null;
  viewerIndex = 0;
  deletingStory = false;

  private viewedStoryIds = new Set<number>();
  private pendingViewedStoryIds = new Set<number>();
  private storiesRefreshIntervalId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.currentUserId = this.authService.currentUserValue?.userId ?? null;
    this.loadActiveStories();
    this.storiesRefreshIntervalId = setInterval(() => {
      this.loadActiveStories();
    }, 60_000);
  }

  ngOnDestroy(): void {
    if (this.storiesRefreshIntervalId) {
      clearInterval(this.storiesRefreshIntervalId);
      this.storiesRefreshIntervalId = null;
    }
    this.releaseSelectedStoryPreview();
  }

  loadActiveStories(): void {
    this.storiesLoading = true;
    this.storiesError = false;

    this.mediaService.getActiveStories().subscribe({
      next: (stories) => {
        this.storyGroups = this.buildStoryGroups(stories);
        this.storiesLoading = false;
      },
      error: () => {
        this.storyGroups = [];
        this.storiesLoading = false;
        this.storiesError = true;
      }
    });
  }

  openCreateStoryModal(): void {
    this.showCreateModal = true;
    this.createStoryError = '';
  }

  closeCreateStoryModal(): void {
    this.showCreateModal = false;
    this.storyCaption = '';
    this.selectedStoryFile = null;
    this.createStoryError = '';
    this.releaseSelectedStoryPreview();
  }

  triggerStoryFilePicker(): void {
    this.storyFileInput?.nativeElement.click();
  }

  onStoryFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selectedFile = input.files?.[0];

    if (!selectedFile) {
      return;
    }

    const fileType = selectedFile.type.toLowerCase();
    const isImage = fileType.startsWith('image/');
    const isMp4Video = fileType === 'video/mp4';

    if (!isImage && !isMp4Video) {
      this.createStoryError = 'Only images and MP4 videos are supported for stories.';
      input.value = '';
      return;
    }

    this.releaseSelectedStoryPreview();
    this.selectedStoryFile = selectedFile;
    this.selectedStoryPreviewUrl = URL.createObjectURL(selectedFile);
    this.createStoryError = '';
    input.value = '';
  }

  removeSelectedStoryFile(): void {
    this.selectedStoryFile = null;
    this.createStoryError = '';
    this.releaseSelectedStoryPreview();
  }

  submitStory(): void {
    if (!this.selectedStoryFile || this.creatingStory) {
      return;
    }

    const file = this.selectedStoryFile;
    const caption = this.storyCaption.trim();

    this.creatingStory = true;
    this.createStoryError = '';

    this.mediaService.uploadFile(file).pipe(
      switchMap((uploadedMedia) => {
        const storyPayload: CreateStoryRequest = {
          mediaUrl: uploadedMedia.url,
          mediaType: this.resolveStoryMediaType(uploadedMedia, file)
        };

        if (caption) {
          storyPayload.caption = caption;
        }

        return this.mediaService.createStory(storyPayload);
      }),
      finalize(() => {
        this.creatingStory = false;
      })
    ).subscribe({
      next: () => {
        this.closeCreateStoryModal();
        this.loadActiveStories();
      },
      error: () => {
        this.createStoryError = 'Unable to create story right now. Please try again.';
      }
    });
  }

  openStoryGroup(group: StoryGroup): void {
    if (!group || group.stories.length === 0) {
      return;
    }

    if (this.currentUserId && group.authorId === this.currentUserId) {
      this.mediaService.getStoriesByUser(group.authorId).pipe(
        catchError(() => of(group.stories))
      ).subscribe((stories) => {
        const normalizedStories = this.normalizeStories(stories);
        if (normalizedStories.length === 0) {
          return;
        }
        this.openViewer(group.authorId, normalizedStories);
      });
      return;
    }

    this.openViewer(group.authorId, group.stories);
  }

  closeStoryViewer(): void {
    this.showViewer = false;
    this.viewerStories = [];
    this.viewerAuthorId = null;
    this.viewerIndex = 0;
    this.deletingStory = false;
  }

  showPreviousStory(): void {
    if (this.viewerIndex <= 0) {
      return;
    }

    this.viewerIndex -= 1;
    this.markCurrentStoryAsViewed();
  }

  showNextStory(): void {
    if (this.viewerIndex >= this.viewerStories.length - 1) {
      this.closeStoryViewer();
      return;
    }

    this.viewerIndex += 1;
    this.markCurrentStoryAsViewed();
  }

  deleteCurrentStory(): void {
    const story = this.currentStory;
    if (!story || this.currentUserId !== story.authorId || this.deletingStory) {
      return;
    }

    this.deletingStory = true;
    this.mediaService.deleteStory(story.storyId).pipe(
      finalize(() => {
        this.deletingStory = false;
      })
    ).subscribe({
      next: () => {
        this.removeStoryFromState(story.storyId, story.authorId);
      },
      error: () => {}
    });
  }

  isGroupSeen(group: StoryGroup): boolean {
    return group.stories.every((story) => this.viewedStoryIds.has(story.storyId));
  }

  getStoryAuthorLabel(authorId: number): string {
    if (this.currentUserId && authorId === this.currentUserId) {
      return 'You';
    }
    return this.getUserDisplayName(authorId);
  }

  getUserDisplayName(userId: number): string {
    return this.userDisplayNames[userId] || `${this.fallbackUserLabel} ${userId}`;
  }

  getUserInitial(userId: number): string {
    const displayName = this.getUserDisplayName(userId).trim();
    return displayName ? displayName.charAt(0).toUpperCase() : 'U';
  }

  resolveStoryMediaUrl(url: string): string {
    if (!url) {
      return '';
    }

    const trimmedUrl = url.trim();
    if (
      trimmedUrl.startsWith('http://') ||
      trimmedUrl.startsWith('https://') ||
      trimmedUrl.startsWith('blob:') ||
      trimmedUrl.startsWith('data:')
    ) {
      return trimmedUrl;
    }

    if (trimmedUrl.startsWith('/')) {
      return `${this.mediaBaseUrl}${trimmedUrl}`;
    }

    return `${this.mediaBaseUrl}/${trimmedUrl}`;
  }

  isStoryVideo(story: Story): boolean {
    if (story.mediaType === 'VIDEO') {
      return true;
    }

    const normalizedUrl = this.resolveStoryMediaUrl(story.mediaUrl).toLowerCase();
    return normalizedUrl.endsWith('.mp4') || normalizedUrl.includes('/videos/');
  }

  canDeleteStory(story: Story): boolean {
    return this.currentUserId === story.authorId;
  }

  preventModalClose(event: MouseEvent): void {
    event.stopPropagation();
  }

  get currentStory(): Story | null {
    return this.viewerStories[this.viewerIndex] ?? null;
  }

  private openViewer(authorId: number, stories: Story[]): void {
    const orderedStories = this.normalizeStories(stories);
    if (orderedStories.length === 0) {
      return;
    }

    this.viewerAuthorId = authorId;
    this.viewerStories = orderedStories;
    const firstUnseenIndex = orderedStories.findIndex(
      (story) => !this.viewedStoryIds.has(story.storyId)
    );
    this.viewerIndex = firstUnseenIndex >= 0 ? firstUnseenIndex : orderedStories.length - 1;
    this.showViewer = true;
    this.markCurrentStoryAsViewed();
  }

  private markCurrentStoryAsViewed(): void {
    const activeStory = this.currentStory;
    if (!activeStory) {
      return;
    }

    const storyId = activeStory.storyId;
    if (this.viewedStoryIds.has(storyId) || this.pendingViewedStoryIds.has(storyId)) {
      return;
    }

    this.pendingViewedStoryIds.add(storyId);
    this.mediaService.viewStory(storyId).pipe(
      finalize(() => this.pendingViewedStoryIds.delete(storyId))
    ).subscribe({
      next: () => this.viewedStoryIds.add(storyId),
      error: () => {}
    });
  }

  private removeStoryFromState(storyId: number, authorId: number): void {
    this.storyGroups = this.storyGroups
      .map((group) => {
        if (group.authorId !== authorId) {
          return group;
        }

        const remainingStories = group.stories.filter((story) => story.storyId !== storyId);
        if (remainingStories.length === 0) {
          return null;
        }

        return {
          authorId: group.authorId,
          stories: remainingStories,
          latestStory: remainingStories[remainingStories.length - 1]
        };
      })
      .filter((group): group is StoryGroup => group !== null);

    if (this.viewerAuthorId !== authorId) {
      return;
    }

    this.viewerStories = this.viewerStories.filter((story) => story.storyId !== storyId);
    if (this.viewerStories.length === 0) {
      this.closeStoryViewer();
      return;
    }

    if (this.viewerIndex >= this.viewerStories.length) {
      this.viewerIndex = this.viewerStories.length - 1;
    }
    this.markCurrentStoryAsViewed();
  }

  private buildStoryGroups(stories: Story[]): StoryGroup[] {
    const groupedStories = new Map<number, Story[]>();
    const normalizedStories = this.normalizeStories(stories);

    for (const story of normalizedStories) {
      if (!groupedStories.has(story.authorId)) {
        groupedStories.set(story.authorId, []);
      }
      groupedStories.get(story.authorId)?.push(story);
    }

    const groups: StoryGroup[] = [];
    for (const [authorId, authorStories] of groupedStories) {
      const latestStory = authorStories[authorStories.length - 1];
      groups.push({
        authorId,
        stories: authorStories,
        latestStory
      });
      this.loadUserDisplayName(authorId);
    }

    return groups.sort((groupA, groupB) => {
      if (
        this.currentUserId &&
        groupA.authorId === this.currentUserId &&
        groupB.authorId !== this.currentUserId
      ) {
        return -1;
      }
      if (
        this.currentUserId &&
        groupB.authorId === this.currentUserId &&
        groupA.authorId !== this.currentUserId
      ) {
        return 1;
      }

      return this.toTimestamp(groupB.latestStory.createdAt) - this.toTimestamp(groupA.latestStory.createdAt);
    });
  }

  private normalizeStories(stories: Story[]): Story[] {
    const nowTimestamp = Date.now();
    return (stories || [])
      .filter((story) => this.isStoryCurrentlyActive(story, nowTimestamp))
      .sort((storyA, storyB) => this.toTimestamp(storyA.createdAt) - this.toTimestamp(storyB.createdAt));
  }

  private isStoryCurrentlyActive(story: Story | null | undefined, nowTimestamp = Date.now()): boolean {
    if (!story || story.isActive === false) {
      return false;
    }

    const expiresAtTimestamp = this.toTimestamp(story.expiresAt);
    if (expiresAtTimestamp > 0) {
      return expiresAtTimestamp > nowTimestamp;
    }

    const createdAtTimestamp = this.toTimestamp(story.createdAt);
    if (createdAtTimestamp <= 0) {
      return true;
    }

    const defaultExpiryWindowMs = 24 * 60 * 60 * 1000;
    return createdAtTimestamp + defaultExpiryWindowMs > nowTimestamp;
  }

  private loadUserDisplayName(userId: number): void {
    if (!userId || this.userDisplayNames[userId]) {
      return;
    }

    this.authService.getUserById(userId).pipe(
      catchError(() => of<User | null>(null))
    ).subscribe((user) => {
      const fullName = user?.fullName?.trim();
      const username = user?.username?.trim();
      this.userDisplayNames[userId] = fullName || username || `${this.fallbackUserLabel} ${userId}`;
    });
  }

  private resolveStoryMediaType(uploadedMedia: MediaResponse, sourceFile: File): StoryMediaType {
    const responseType = uploadedMedia.mediaType?.toUpperCase();
    if (responseType === 'VIDEO') {
      return 'VIDEO';
    }
    if (responseType === 'IMAGE') {
      return 'IMAGE';
    }
    return sourceFile.type.toLowerCase().startsWith('video/') ? 'VIDEO' : 'IMAGE';
  }

  private toTimestamp(dateValue: string | null | undefined): number {
    if (!dateValue) {
      return 0;
    }
    const timestamp = new Date(dateValue).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  private releaseSelectedStoryPreview(): void {
    if (this.selectedStoryPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.selectedStoryPreviewUrl);
    }
    this.selectedStoryPreviewUrl = '';
  }
}
