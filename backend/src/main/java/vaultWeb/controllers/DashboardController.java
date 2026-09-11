package vaultWeb.controllers;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vaultWeb.dtos.dashboard.UserDashboardDto;
import vaultWeb.exceptions.UnauthorizedException;
import vaultWeb.exceptions.notfound.UserNotFoundException;
import vaultWeb.models.User;
import vaultWeb.repositories.UserRepository;
import vaultWeb.services.DashboardService;
import vaultWeb.services.auth.AuthService;

/** Provides aggregated user-centric data to power the dashboard UI. */
@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@Tag(name = "Dashboard Controller", description = "Aggregated view of user related data")
public class DashboardController {

  private final DashboardService dashboardService;
  private final AuthService authService;
  private final UserRepository userRepository;

  @GetMapping("/me")
  @Operation(summary = "Get dashboard data for the authenticated user")
  public ResponseEntity<UserDashboardDto> getCurrentUserDashboard() {
    User currentUser = authService.getCurrentUser();
    if (currentUser == null) {
      throw new UnauthorizedException("User is not authenticated");
    }
    return ResponseEntity.ok(dashboardService.buildDashboard(currentUser));
  }

  @GetMapping("/{username}")
  @Operation(
      summary = "Get dashboard data for a specific user",
      description =
          "Returns dashboard data only when the requested username matches the authenticated "
              + "caller. There is no global-admin role in this system to gate broader access "
              + "on (roles here are scoped per-group via GroupMember/@AdminOnly), so this "
              + "endpoint cannot safely support cross-user lookups. Prefer /api/dashboard/me.")
  public ResponseEntity<UserDashboardDto> getDashboardForUser(@PathVariable String username) {
    User currentUser = authService.getCurrentUser();
    if (currentUser == null) {
      throw new UnauthorizedException("User is not authenticated");
    }

    if (!currentUser.getUsername().equals(username)) {
      throw new AccessDeniedException("Not allowed to view this user's dashboard");
    }

    User targetUser =
        userRepository
            .findByUsername(username)
            .orElseThrow(() -> new UserNotFoundException("User not found: " + username));
    return ResponseEntity.ok(dashboardService.buildDashboard(targetUser));
  }
}
