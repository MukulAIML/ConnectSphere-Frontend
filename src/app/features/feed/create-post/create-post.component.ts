import { Component, EventEmitter, Output, ViewChild, ElementRef } from '@angular/core';
import { inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PostService } from '../../../core/services/post.service';
import { MediaService } from '../../../core/services/media.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-create-post',
  imports: [FormsModule],
  templateUrl: './create-post.component.html',
  styleUrls: ['./create-post.component.css']
})
export class CreatePostComponent {
  private postService = inject(PostService);
  private mediaService = inject(MediaService);
  private readonly maxImageBytes = 10 * 1024 * 1024;
  private readonly maxVideoBytes = 50 * 1024 * 1024;
  private readonly supportedVideoMimeTypes = new Set([
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-m4v',
    'video/m4v'
  ]);

  @Output() postCreated = new EventEmitter<any>();
  @ViewChild('photoInput') photoInput!: ElementRef<HTMLInputElement>;
  @ViewChild('videoInput') videoInput!: ElementRef<HTMLInputElement>;

  content: string = '';
  loading: boolean = false;
  uploadError: string = '';
  selectedFiles: File[] = [];
  filePreviews: { name: string; url: string; type: string }[] = [];

  triggerPhotoInput(): void {
    this.photoInput.nativeElement.click();
  }

  triggerVideoInput(): void {
    this.videoInput.nativeElement.click();
  }

  onFileSelected(event: Event, type: string): void {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.uploadError = '';

    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      const mimeType = (file.type || '').toLowerCase();
      const isPhotoPicker = type === 'photo';

      if (isPhotoPicker && !mimeType.startsWith('image/')) {
        this.uploadError = 'Only image files are allowed in the photo picker.';
        continue;
      }

      if (!isPhotoPicker) {
        if (!mimeType.startsWith('video/')) {
          this.uploadError = 'Only video files are allowed in the video picker.';
          continue;
        }
        if (!this.supportedVideoMimeTypes.has(mimeType)) {
          this.uploadError = 'Unsupported video format. Use MP4, WebM, MOV, or M4V.';
          continue;
        }
      }

      const maxBytes = isPhotoPicker ? this.maxImageBytes : this.maxVideoBytes;
      if (file.size > maxBytes) {
        this.uploadError = isPhotoPicker
          ? 'Image size must be 10 MB or less.'
          : 'Video size must be 50 MB or less.';
        continue;
      }

      this.selectedFiles.push(file);

      if (mimeType.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.filePreviews.push({
            name: file.name,
            url: e.target?.result as string,
            type: 'image'
          });
        };
        reader.readAsDataURL(file);
      } else {
        this.filePreviews.push({
          name: file.name,
          url: '',
          type: 'video'
        });
      }
    }

    // Reset input so same file can be selected again
    input.value = '';
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.filePreviews.splice(index, 1);
  }

  onSubmit(): void {
    if (!this.content.trim() && this.selectedFiles.length === 0) return;

    this.loading = true;
    this.uploadError = '';

    if (this.selectedFiles.length > 0) {
      // Upload files first, then create post with media URLs
      const uploads$ = this.selectedFiles.map(f => this.mediaService.uploadFile(f));
      forkJoin(uploads$).subscribe({
        next: (mediaResponses) => {
          const mediaUrls = mediaResponses.map(m => m.url);
          this.createPostWithPayload({
            content: this.content,
            mediaUrls,
            postType: 'MEDIA',
            visibility: 'PUBLIC'
          });
        },
        error: (error) => {
          this.uploadError = this.extractErrorMessage(error, 'Unable to upload media. Please try again.');
          this.loading = false;
        }
      });
    } else {
      // Text-only post
      this.createPostWithPayload({
        content: this.content,
        mediaUrls: [],
        postType: 'TEXT',
        visibility: 'PUBLIC'
      });
    }
  }

  private createPostWithPayload(payload: any): void {
    this.postService.createPost(payload).subscribe({
      // Backend returns PostResponseDTO directly (HTTP 201), no wrapper
      next: (post) => {
        this.postCreated.emit(post);
        this.content = '';
        this.selectedFiles = [];
        this.filePreviews = [];
        this.uploadError = '';
        this.loading = false;
      },
      error: (error) => {
        this.uploadError = this.extractErrorMessage(error, 'Unable to create post right now.');
        this.loading = false;
      }
    });
  }

  private extractErrorMessage(error: any, fallback: string): string {
    const apiMessage = error?.error?.message;
    if (typeof apiMessage === 'string' && apiMessage.trim()) {
      return apiMessage;
    }
    return fallback;
  }
}
