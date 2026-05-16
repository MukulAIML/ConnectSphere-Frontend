import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, Observable, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PostService, Post, PostVisibility, ReportReason } from '../../../core/services/post.service';
import {
  CommentService,
  Comment,
  CommentReaction,
  CommentReactionSummary
} from '../../../core/services/comment.service';
import { AuthService, User } from '../../../core/services/auth.service';

@Component({
  selector: 'app-post-card',
  imports: [DatePipe, TitleCasePipe, FormsModule, RouterLink],
  templateUrl: './post-card.component.html',
  styleUrls: ['./post-card.component.css']
})
export class PostCardComponent implements OnChanges {
  private postService = inject(PostService);
  private commentService = inject(CommentService);
  private authService = inject(AuthService);

  @Input() post!: Post;

  showReactionsPicker = false;
  showComments = false;
  comments: Comment[] = [];
  loadingComments = false;
  newCommentText = '';
  submittingComment = false;
  replyDrafts: Record<number, string> = {};
  replyComposerOpen: Record<number, boolean> = {};
  submittingReply: Record<number, boolean> = {};
  loadingReplies: Record<number, boolean> = {};
  showOptionsMenu = false;
  editingPost = false;
  editContent = '';
  savingPost = false;
  deletingPost = false;
  updatingVisibility = false;
  isDeletedLocally = false;
  postActionMessage = '';
  postActionError = '';
  sharingPost = false;

  userDisplayNames: Record<number, string> = {};
  private readonly fallbackUserLabel = 'User';
  private readonly mediaBaseUrl = environment.apiUrl.replace(/\/+$/, '');
  private currentUserId = this.authService.currentUserValue?.userId ?? null;
  readonly visibilities: PostVisibility[] = ['PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE'];
  readonly reportReasons: ReportReason[] = [
    'SPAM',
    'HARASSMENT',
    'HATE_SPEECH',
    'VIOLENCE',
    'NUDITY',
    'MISINFORMATION',
    'IMPERSONATION',
    'SELF_HARM',
    'OTHER'
  ];

  availableReactions = [
    { type: 'LIKE', emoji: '👍' },
    { type: 'LOVE', emoji: '❤️' },
    { type: 'HAHA', emoji: '😂' },
    { type: 'WOW', emoji: '😮' },
    { type: 'SAD', emoji: '😢' },
    { type: 'ANGRY', emoji: '😡' }
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['post'] && this.post?.authorId) {
      this.loadUserDisplayName(this.post.authorId);
      this.editContent = this.post.content || '';
      this.isDeletedLocally = false;
      this.postActionMessage = '';
      this.postActionError = '';
      this.syncPostReactionState();
    }
  }

  getTopReactionEmoji(): string {
    if (!this.post.reactionsSummary) return '👍';
    let maxType = 'LIKE';
    let maxCount = 0;
    for (const [type, count] of Object.entries(this.post.reactionsSummary)) {
      if (count > maxCount) {
        maxCount = count;
        maxType = type;
      }
    }
    const reaction = this.availableReactions.find(r => r.type === maxType);
    return reaction ? reaction.emoji : '👍';
  }

  getTopReactionTypes(limit = 3): string[] {
    if (!this.post.reactionsSummary) return [];

    return Object.entries(this.post.reactionsSummary)
      .filter(([, count]) => Number(count) > 0)
      .sort(([typeA, countA], [typeB, countB]) => {
        const countDifference = Number(countB) - Number(countA);
        if (countDifference !== 0) {
          return countDifference;
        }
        return this.getReactionPriority(typeA) - this.getReactionPriority(typeB);
      })
      .slice(0, limit)
      .map(([type]) => type);
  }

  getTotalReactions(): number {
    if (!this.post.reactionsSummary) return this.post.likesCount || 0;
    const summaryTotal = Object.values(this.post.reactionsSummary).reduce((a, b) => a + b, 0);
    return Math.max(summaryTotal, this.post.likesCount || 0);
  }

  handleReact(type: string): void {
    const isRemoving = this.post.userReactionType === type;
    this.showReactionsPicker = false;
    const oldReaction = this.post.userReactionType;
    const previousSummary = this.post.reactionsSummary
      ? { ...this.post.reactionsSummary }
      : undefined;
    const previousLikesCount = this.post.likesCount ?? 0;

    this.post.userReactionType = isRemoving ? undefined : type;

    if (!this.post.reactionsSummary) {
      this.post.reactionsSummary = {};
    }

    if (oldReaction) {
      this.post.reactionsSummary[oldReaction] = Math.max(0, (this.post.reactionsSummary[oldReaction] || 1) - 1);
    }

    if (!isRemoving) {
      this.post.reactionsSummary[type] = (this.post.reactionsSummary[type] || 0) + 1;
    }

    if (isRemoving) {
      this.post.likesCount = Math.max(0, previousLikesCount - 1);
    } else if (!oldReaction) {
      this.post.likesCount = previousLikesCount + 1;
    }

    let request$: Observable<unknown>;
    if (isRemoving) {
      request$ = this.postService.removeReaction(this.post.postId);
    } else if (oldReaction) {
      request$ = this.postService.changeReaction(this.post.postId, type);
    } else {
      request$ = this.postService.reactToPost(this.post.postId, type);
    }

    request$.subscribe({
      next: () => {
        this.syncPostReactionState();
      },
      error: () => {
        this.post.userReactionType = oldReaction;
        this.post.reactionsSummary = previousSummary;
        this.post.likesCount = previousLikesCount;
      }
    });
  }

  getReactionEmoji(type: string): string {
    return this.availableReactions.find(r => r.type === type)?.emoji ?? '👍';
  }

  private getReactionPriority(type: string): number {
    const index = this.availableReactions.findIndex(reaction => reaction.type === type);
    return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
  }

  resolveMediaUrl(url: string): string {
    if (!url) return '';

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

  isImage(url: string): boolean {
    if (!url) return false;

    const normalizedUrl = this.stripQueryParams(this.resolveMediaUrl(url));
    return (
      normalizedUrl.endsWith('.jpg') ||
      normalizedUrl.endsWith('.jpeg') ||
      normalizedUrl.endsWith('.png') ||
      normalizedUrl.endsWith('.gif') ||
      normalizedUrl.endsWith('.webp') ||
      normalizedUrl.includes('/images/') ||
      normalizedUrl.includes('image/')
    );
  }

  isVideo(url: string): boolean {
    if (!url) return false;

    const normalizedUrl = this.stripQueryParams(this.resolveMediaUrl(url));
    return (
      normalizedUrl.endsWith('.mp4') ||
      normalizedUrl.endsWith('.webm') ||
      normalizedUrl.endsWith('.mov') ||
      normalizedUrl.endsWith('.m4v') ||
      normalizedUrl.includes('/videos/') ||
      normalizedUrl.includes('video/')
    );
  }

  private stripQueryParams(url: string): string {
    return url.toLowerCase().split('#')[0].split('?')[0];
  }

  getUserDisplayName(userId: number): string {
    return this.userDisplayNames[userId] || `${this.fallbackUserLabel} ${userId}`;
  }

  getUserInitial(userId: number): string {
    const displayName = this.getUserDisplayName(userId).trim();
    return displayName ? displayName.charAt(0).toUpperCase() : 'U';
  }

  get isOwnPost(): boolean {
    return this.currentUserId !== null && this.currentUserId === this.post.authorId;
  }

  toggleOptionsMenu(): void {
    this.showOptionsMenu = !this.showOptionsMenu;
  }

  closeOptionsMenu(): void {
    this.showOptionsMenu = false;
  }

  startEditingPost(): void {
    if (!this.isOwnPost) {
      return;
    }
    this.editingPost = true;
    this.editContent = this.post.content || '';
    this.postActionMessage = '';
    this.postActionError = '';
    this.closeOptionsMenu();
  }

  cancelEditingPost(): void {
    this.editingPost = false;
    this.editContent = this.post.content || '';
  }

  savePostEdits(): void {
    const content = this.editContent.trim();
    if (!content || this.savingPost) {
      return;
    }

    this.savingPost = true;
    this.postService.updatePost(this.post.postId, {
      content,
      mediaUrls: this.post.mediaUrls || [],
      postType: this.post.postType,
      visibility: this.post.visibility
    }).subscribe({
      next: (updated) => {
        this.post.content = updated.content;
        this.post.updatedAt = updated.updatedAt;
        this.postActionError = '';
        this.postActionMessage = 'Post updated.';
        this.editingPost = false;
        this.savingPost = false;
      },
      error: () => {
        this.postActionError = 'Unable to update post.';
        this.savingPost = false;
      }
    });
  }

  changeVisibility(visibility: PostVisibility): void {
    if (!this.isOwnPost || this.updatingVisibility || this.post.visibility === visibility) {
      return;
    }

    this.updatingVisibility = true;
    this.postService.changeVisibility(this.post.postId, visibility).subscribe({
      next: (updated) => {
        this.post.visibility = updated.visibility;
        this.postActionError = '';
        this.postActionMessage = `Visibility changed to ${this.readableVisibility(updated.visibility)}.`;
        this.updatingVisibility = false;
      },
      error: () => {
        this.postActionError = 'Unable to change visibility.';
        this.updatingVisibility = false;
      }
    });
  }

  deletePost(): void {
    if (!this.isOwnPost || this.deletingPost) {
      return;
    }

    if (!confirm('Delete this post?')) {
      return;
    }

    this.deletingPost = true;
    this.postService.deletePost(this.post.postId).subscribe({
      next: () => {
        this.isDeletedLocally = true;
        this.deletingPost = false;
      },
      error: () => {
        this.postActionError = 'Unable to delete post.';
        this.deletingPost = false;
      }
    });
  }

  sharePost(): void {
    if (this.sharingPost) {
      return;
    }
    this.sharingPost = true;
    this.postService.sharePost(this.post.postId).subscribe({
      next: () => {
        this.postActionError = '';
        this.postActionMessage = 'Post link copied/shared.';
        this.sharingPost = false;
      },
      error: () => {
        this.postActionError = 'Unable to share post right now.';
        this.sharingPost = false;
      }
    });
  }

  reportPost(): void {
    const payload = this.promptReportPayload();
    if (!payload) {
      return;
    }

    this.postService.reportPost(this.post.postId, payload).subscribe({
      next: () => {
        this.postActionError = '';
        this.postActionMessage = 'Post reported successfully.';
      },
      error: () => {
        this.postActionError = 'Unable to report this post.';
      }
    });
    this.closeOptionsMenu();
  }

  reportComment(comment: Comment): void {
    const payload = this.promptReportPayload();
    if (!payload) {
      return;
    }

    this.postService.reportPost(this.post.postId, {
      ...payload,
      targetType: 'COMMENT',
      targetId: comment.commentId
    }).subscribe({
      next: () => {
        this.postActionError = '';
        this.postActionMessage = 'Comment reported successfully.';
      },
      error: () => {
        this.postActionError = 'Unable to report this comment.';
      }
    });
  }

  extractHashtags(content: string): string[] {
    if (!content) {
      return [];
    }

    const regex = /#([A-Za-z0-9_]+)/g;
    const tags = new Set<string>();
    let match: RegExpExecArray | null = regex.exec(content);
    while (match !== null) {
      if (match[1]) {
        tags.add(match[1]);
      }
      match = regex.exec(content);
    }
    return Array.from(tags);
  }

  readableVisibility(visibility: PostVisibility): string {
    return visibility.replace('_', ' ').toLowerCase();
  }

  private promptReportPayload(): { reason: ReportReason; details?: string } | null {
    const reasonInput = prompt(
      `Report reason (${this.reportReasons.join(', ')}):`,
      'SPAM'
    );

    if (reasonInput === null) {
      return null;
    }

    const normalizedReason = reasonInput.trim().toUpperCase() as ReportReason;
    if (!this.reportReasons.includes(normalizedReason)) {
      this.postActionError = 'Invalid report reason.';
      return null;
    }

    const detailsInput = prompt('Optional details:', '');
    if (detailsInput === null) {
      return null;
    }

    const details = detailsInput.trim();
    return {
      reason: normalizedReason,
      details: details || undefined
    };
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

  private hydrateCommentAuthorNames(): void {
    const uniqueAuthorIds = new Set(
      this.flattenComments(this.comments)
        .map(comment => comment.authorId)
        .filter((authorId): authorId is number => Number.isFinite(authorId))
    );

    uniqueAuthorIds.forEach(authorId => this.loadUserDisplayName(authorId));
  }

  private flattenComments(comments: Comment[]): Comment[] {
    const flattened: Comment[] = [];
    for (const comment of comments) {
      flattened.push(comment);
      if (comment.replies && comment.replies.length > 0) {
        flattened.push(...comment.replies);
      }
    }
    return flattened;
  }

  getCommentReactionTotal(comment: Comment): number {
    if (comment.reactionsSummary) {
      return Object.values(comment.reactionsSummary).reduce((sum, value) => sum + value, 0);
    }
    return comment.likesCount ?? 0;
  }

  toggleCommentReaction(comment: Comment, reactionType = 'LIKE'): void {
    const previousReaction = comment.userReactionType;
    const previousSummary = comment.reactionsSummary ? { ...comment.reactionsSummary } : undefined;
    const previousLikesCount = comment.likesCount ?? 0;

    let request$: Observable<unknown>;
    if (previousReaction === reactionType) {
      comment.userReactionType = undefined;
      comment.likesCount = Math.max(0, previousLikesCount - 1);
      this.adjustReactionSummary(comment, reactionType, -1);
      request$ = this.commentService.removeCommentReaction(comment.commentId);
    } else if (previousReaction) {
      comment.userReactionType = reactionType;
      this.adjustReactionSummary(comment, previousReaction, -1);
      this.adjustReactionSummary(comment, reactionType, 1);
      request$ = this.commentService.changeCommentReaction(comment.commentId, reactionType);
    } else {
      comment.userReactionType = reactionType;
      comment.likesCount = previousLikesCount + 1;
      this.adjustReactionSummary(comment, reactionType, 1);
      request$ = this.commentService.reactToComment(comment.commentId, reactionType);
    }

    request$.subscribe({
      error: () => {
        comment.userReactionType = previousReaction;
        comment.reactionsSummary = previousSummary;
        comment.likesCount = previousLikesCount;
      }
    });
  }

  private adjustReactionSummary(comment: Comment, reactionType: string, delta: number): void {
    if (!comment.reactionsSummary) {
      comment.reactionsSummary = {};
    }
    const current = comment.reactionsSummary[reactionType] ?? 0;
    const nextValue = current + delta;
    comment.reactionsSummary[reactionType] = nextValue > 0 ? nextValue : 0;
  }

  private syncCommentReactionState(comment: Comment): void {
    this.commentService.getCommentReactionSummary(comment.commentId).pipe(
      catchError(() => of<CommentReactionSummary | null>(null))
    ).subscribe((summary) => {
      if (!summary) return;

      const normalizedSummary: Record<string, number> = {};
      for (const [reaction, count] of Object.entries(summary.reactions ?? {})) {
        normalizedSummary[reaction] = Number(count);
      }
      comment.reactionsSummary = normalizedSummary;
      comment.likesCount = Number(summary.totalCount ?? comment.likesCount ?? 0);
    });

    this.commentService.getUserCommentReaction(comment.commentId).pipe(
      catchError(() => of<CommentReaction | null>(null))
    ).subscribe((reaction) => {
      comment.userReactionType = reaction?.reactionType;
    });
  }

  private syncReactionStateForLoadedComments(): void {
    this.flattenComments(this.comments).forEach(comment => this.syncCommentReactionState(comment));
  }

  private syncPostReactionState(): void {
    this.postService.getReactionSummary(this.post.postId).pipe(
      catchError(() => of<{
        totalCount?: number;
        reactions?: Record<string, number>;
      } | null>(null))
    ).subscribe((summary) => {
      if (!summary) return;

      const normalizedSummary: Record<string, number> = {};
      for (const [reaction, count] of Object.entries(summary.reactions ?? {})) {
        normalizedSummary[reaction] = Number(count);
      }

      this.post.reactionsSummary = normalizedSummary;
      this.post.likesCount = Number(summary.totalCount ?? this.post.likesCount ?? 0);
    });

    this.postService.getUserReaction(this.post.postId).pipe(
      catchError(() => of<{ reactionType?: string } | null>(null))
    ).subscribe((reaction) => {
      this.post.userReactionType = reaction?.reactionType;
    });
  }

  toggleReplyComposer(commentId: number): void {
    this.replyComposerOpen[commentId] = !this.replyComposerOpen[commentId];
  }

  closeReplyComposer(commentId: number): void {
    this.replyComposerOpen[commentId] = false;
    this.replyDrafts[commentId] = '';
  }

  submitReply(parentComment: Comment): void {
    const draft = (this.replyDrafts[parentComment.commentId] || '').trim();
    if (!draft) return;

    this.submittingReply[parentComment.commentId] = true;
    this.commentService.addReply(parentComment.commentId, parentComment.postId, draft).subscribe({
      next: (reply) => {
        if (!parentComment.replies) {
          parentComment.replies = [];
        }
        parentComment.replies.push(reply);
        this.replyDrafts[parentComment.commentId] = '';
        this.replyComposerOpen[parentComment.commentId] = false;
        this.loadUserDisplayName(reply.authorId);
        this.syncCommentReactionState(reply);
        this.submittingReply[parentComment.commentId] = false;
        this.post.commentsCount = (this.post.commentsCount || 0) + 1;
      },
      error: () => {
        this.submittingReply[parentComment.commentId] = false;
      }
    });
  }

  private loadRepliesForComment(comment: Comment, force = false): void {
    if (this.loadingReplies[comment.commentId]) {
      return;
    }

    if (!force && comment.replies && comment.replies.length > 0) {
      comment.replies.forEach(reply => this.syncCommentReactionState(reply));
      return;
    }

    this.loadingReplies[comment.commentId] = true;
    this.commentService.getRepliesByComment(comment.commentId).subscribe({
      next: (replies) => {
        comment.replies = replies || [];
        this.hydrateCommentAuthorNames();
        comment.replies.forEach(reply => this.syncCommentReactionState(reply));
        this.loadingReplies[comment.commentId] = false;
      },
      error: () => {
        this.loadingReplies[comment.commentId] = false;
      }
    });
  }

  // --- Comments ---

  toggleComments(): void {
    this.showComments = !this.showComments;
    if (this.showComments && this.comments.length === 0) {
      this.loadComments();
    }
  }

  loadComments(): void {
    this.loadingComments = true;
    this.commentService.getCommentsByPost(this.post.postId).subscribe({
      next: (comments) => {
        this.comments = (comments || []).map(comment => ({
          ...comment,
          replies: comment.replies ?? []
        }));
        this.comments.forEach(comment => this.loadRepliesForComment(comment));
        this.hydrateCommentAuthorNames();
        this.syncReactionStateForLoadedComments();
        this.loadingComments = false;
      },
      error: () => {
        this.loadingComments = false;
      }
    });
  }

  submitComment(): void {
    if (!this.newCommentText.trim()) return;
    this.submittingComment = true;

    this.commentService.addComment(this.post.postId, this.newCommentText).subscribe({
      next: (comment) => {
        this.comments.unshift(comment);
        this.loadUserDisplayName(comment.authorId);
        this.newCommentText = '';
        this.submittingComment = false;
        this.post.commentsCount = (this.post.commentsCount || 0) + 1;
      },
      error: () => {
        this.submittingComment = false;
      }
    });
  }

  deleteComment(commentId: number, index: number): void {
    const repliesDeleted = this.comments[index]?.replies?.length ?? 0;
    this.commentService.deleteComment(commentId).subscribe({
      next: () => {
        this.comments.splice(index, 1);
        this.post.commentsCount = Math.max(0, (this.post.commentsCount || 1) - (1 + repliesDeleted));
      }
    });
  }

  deleteReply(parentComment: Comment, replyId: number, replyIndex: number): void {
    this.commentService.deleteComment(replyId).subscribe({
      next: () => {
        if (!parentComment.replies) {
          return;
        }
        parentComment.replies.splice(replyIndex, 1);
        this.post.commentsCount = Math.max(0, (this.post.commentsCount || 1) - 1);
      }
    });
  }
}
