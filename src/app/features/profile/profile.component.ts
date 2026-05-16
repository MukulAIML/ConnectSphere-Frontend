import { Component, OnInit } from '@angular/core';
import { inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService, User } from '../../core/services/auth.service';
import { PostService, Post } from '../../core/services/post.service';
import { FollowService } from '../../core/services/follow.service';
import { PostCardComponent } from '../feed/post-card/post-card.component';

@Component({
  selector: 'app-profile',
  imports: [PostCardComponent],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  private authService = inject(AuthService);
  private postService = inject(PostService);
  private followService = inject(FollowService);
  private route = inject(ActivatedRoute);

  user: User | null = null;
  profileUserId!: number;
  isOwnProfile = true;
  posts: Post[] = [];
  loadingPosts = true;
  followerCount = 0;
  followingCount = 0;
  isFollowing = false;
  followLoading = false;
  loadingProfile = true;
  profileLoadError = '';

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const currentUser = this.authService.currentUserValue;
      if (!currentUser) return;

      if (params['userId']) {
        this.profileUserId = Number(params['userId']);
        if (!Number.isFinite(this.profileUserId) || this.profileUserId <= 0) {
          this.user = null;
          this.loadingProfile = false;
          this.profileLoadError = 'Invalid profile requested.';
          return;
        }
        this.isOwnProfile = this.profileUserId === currentUser.userId;
      } else {
        this.profileUserId = currentUser.userId;
        this.isOwnProfile = true;
      }

      this.loadingProfile = true;
      this.profileLoadError = '';

      if (this.isOwnProfile) {
        this.user = currentUser;
      } else {
        this.user = null;
      }

      this.loadProfileUser();
      this.loadPosts();
      this.loadFollowCounts();
      if (!this.isOwnProfile) {
        this.checkFollowStatus();
      } else {
        this.isFollowing = false;
      }
    });
  }

  loadProfileUser(): void {
    this.authService.getUserById(this.profileUserId).subscribe({
      next: (user) => {
        this.user = user;
        this.loadingProfile = false;
        this.profileLoadError = '';
      },
      error: () => {
        // Keep current session user as fallback for own profile.
        if (this.isOwnProfile) {
          this.user = this.authService.currentUserValue;
          this.profileLoadError = '';
        } else {
          this.user = null;
          this.profileLoadError = 'Unable to load this profile.';
        }
        this.loadingProfile = false;
      }
    });
  }

  loadPosts(): void {
    this.loadingPosts = true;
    this.postService.getPostsByUser(this.profileUserId).subscribe({
      next: (posts) => {
        this.posts = posts || [];
        this.loadingPosts = false;
      },
      error: () => {
        this.loadingPosts = false;
      }
    });
  }

  loadFollowCounts(): void {
    this.followService.getFollowerCount(this.profileUserId).subscribe({
      next: (count) => this.followerCount = count
    });
    this.followService.getFollowingCount(this.profileUserId).subscribe({
      next: (count) => this.followingCount = count
    });
  }

  checkFollowStatus(): void {
    this.followService.isFollowing(this.profileUserId).subscribe({
      next: (following) => this.isFollowing = following
    });
  }

  toggleFollow(): void {
    this.followLoading = true;
    if (this.isFollowing) {
      this.followService.unfollowUser(this.profileUserId).subscribe({
        next: () => {
          this.isFollowing = false;
          this.followerCount = Math.max(0, this.followerCount - 1);
          this.followLoading = false;
        },
        error: () => { this.followLoading = false; }
      });
    } else {
      this.followService.followUser(this.profileUserId).subscribe({
        next: () => {
          this.isFollowing = true;
          this.followerCount++;
          this.followLoading = false;
        },
        error: () => { this.followLoading = false; }
      });
    }
  }
}
