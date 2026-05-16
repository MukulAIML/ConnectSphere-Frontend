import { Component, OnInit } from '@angular/core';
import { inject } from '@angular/core';
import { PostService, Post } from '../../../core/services/post.service';
import { AuthService } from '../../../core/services/auth.service';
import { CreatePostComponent } from '../create-post/create-post.component';
import { PostCardComponent } from '../post-card/post-card.component';
import { StoryStripComponent } from '../story-strip/story-strip.component';

@Component({
  selector: 'app-home-feed',
  imports: [StoryStripComponent, CreatePostComponent, PostCardComponent],
  templateUrl: './home-feed.component.html',
  styleUrls: ['./home-feed.component.css']
})
export class HomeFeedComponent implements OnInit {
  private postService = inject(PostService);
  private authService = inject(AuthService);

  posts: Post[] = [];
  loading = true;

  ngOnInit(): void {
    this.loadFeed();
  }

  loadFeed(): void {
    const user = this.authService.currentUserValue;
    if (!user) return;

    this.postService.getFeed(user.userId).subscribe({
      next: (posts: Post[]) => {
        // Backend returns List<PostResponseDTO> directly — no wrapper
        this.posts = posts || [];
        this.loading = false;
      },
      error: () => {
        this.posts = [];
        this.loading = false;
      }
    });
  }

  onPostCreated(newPost: Post): void {
    this.posts.unshift(newPost);
  }
}
