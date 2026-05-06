import { Component, Input } from '@angular/core';
import { inject } from '@angular/core';
import { DatePipe, TitleCasePipe } from '@angular/common';
import { PostService, Post } from '../../../core/services/post.service';

@Component({
  selector: 'app-post-card',
  imports: [DatePipe, TitleCasePipe],
  templateUrl: './post-card.component.html',
  styleUrls: ['./post-card.component.css']
})
export class PostCardComponent {
  private postService = inject(PostService);

  @Input() post!: Post;

  showReactionsPicker = false;

  availableReactions = [
    { type: 'LIKE', emoji: '👍' },
    { type: 'LOVE', emoji: '❤️' },
    { type: 'HAHA', emoji: '😂' },
    { type: 'WOW', emoji: '😮' },
    { type: 'SAD', emoji: '😢' },
    { type: 'ANGRY', emoji: '😡' }
  ];

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

  getTotalReactions(): number {
    if (!this.post.reactionsSummary) return 0;
    return Object.values(this.post.reactionsSummary).reduce((a, b) => a + b, 0);
  }

  handleReact(type: string): void {
    const isRemoving = this.post.userReactionType === type;
    this.showReactionsPicker = false;
    const oldReaction = this.post.userReactionType;
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
      this.postService.removeReaction(this.post.postId).subscribe();
    } else {
      this.postService.reactToPost(this.post.postId, type).subscribe();
    }
  }

  getReactionEmoji(type: string): string {
    return this.availableReactions.find(r => r.type === type)?.emoji ?? '👍';
  }
}
