import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Subscription, catchError, of, switchMap } from 'rxjs';
import { Post } from '../../core/services/post.service';
import { SearchService } from '../../core/services/search.service';
import { PostCardComponent } from '../feed/post-card/post-card.component';

@Component({
  selector: 'app-hashtag-feed',
  imports: [RouterLink, PostCardComponent],
  templateUrl: './hashtag-feed.component.html',
  styleUrls: ['./hashtag-feed.component.css']
})
export class HashtagFeedComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private searchService = inject(SearchService);

  tag = '';
  posts: Post[] = [];
  loading = true;
  error = '';

  private routeSubscription?: Subscription;

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.pipe(
      switchMap((params) => {
        this.tag = (params.get('tag') || '').trim();
        if (!this.tag) {
          this.error = 'Hashtag not provided.';
          this.posts = [];
          this.loading = false;
          return of([] as Post[]);
        }

        this.loading = true;
        this.error = '';
        this.posts = [];

        return this.searchService.getPostsByHashtag(this.tag).pipe(
          catchError(() => {
            this.error = 'Unable to load posts for this hashtag right now.';
            return of([] as Post[]);
          })
        );
      })
    ).subscribe((posts) => {
      this.posts = posts || [];
      this.loading = false;
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }
}
