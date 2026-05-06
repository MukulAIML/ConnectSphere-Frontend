import { Component, EventEmitter, Output } from '@angular/core';
import { inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PostService } from '../../../core/services/post.service';

@Component({
  selector: 'app-create-post',
  imports: [FormsModule],
  templateUrl: './create-post.component.html',
  styleUrls: ['./create-post.component.css']
})
export class CreatePostComponent {
  private postService = inject(PostService);

  @Output() postCreated = new EventEmitter<any>();
  content: string = '';
  loading: boolean = false;

  onSubmit(): void {
    if (!this.content.trim()) return;

    this.loading = true;
    const payload = {
      content: this.content,
      mediaUrls: [],
      postType: 'TEXT',
      visibility: 'PUBLIC'
    };

    this.postService.createPost(payload).subscribe({

      next: (response: any) => {
        if (response.data) {
          this.postCreated.emit(response.data);
          this.content = '';
        }
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }
}
