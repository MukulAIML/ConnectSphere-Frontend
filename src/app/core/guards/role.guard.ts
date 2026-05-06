import { Injectable, inject } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {
  private authService = inject(AuthService);
  private router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    const currentUser = this.authService.currentUserValue;
    const allowedRoles = route.data['roles'] as Array<string>;

    if (currentUser && allowedRoles && allowedRoles.includes(currentUser.role)) {
      return true;
    }
    this.router.navigate(['/']);
    return false;
  }
}
