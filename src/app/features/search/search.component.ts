import { Component, OnInit, OnDestroy } from '@angular/core';
import { inject } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { EMPTY } from 'rxjs';
import { RouterLink } from '@angular/router';
import { SearchService } from '../../core/services/search.service';

@Component({
  selector: 'app-search',
  imports: [RouterLink],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.css']
})
export class SearchComponent implements OnInit, OnDestroy {
  private searchService = inject(SearchService);

  searchResults: any[] = [];
  loading = false;
  hasSearched = false;

  private searchSubject = new Subject<string>();
  private searchSubscription!: Subscription;

  ngOnInit(): void {
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query.trim()) {
          this.searchResults = [];
          this.loading = false;
          this.hasSearched = false;
          return EMPTY;
        }
        this.loading = true;
        this.hasSearched = true;
        return this.searchService.searchUsers(query).pipe(
          catchError(() => {
            this.loading = false;
            return EMPTY;
          })
        );
      })
    ).subscribe({
      next: (response: any) => {
        this.searchResults = response.data || [];
        this.loading = false;
      }
    });
  }

  onSearch(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchSubject.next(query);
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }
}
