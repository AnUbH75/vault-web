package vaultWeb.controllers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import vaultWeb.dtos.dashboard.UserDashboardDto;
import vaultWeb.exceptions.UnauthorizedException;
import vaultWeb.exceptions.notfound.UserNotFoundException;
import vaultWeb.models.User;
import vaultWeb.repositories.UserRepository;
import vaultWeb.services.DashboardService;
import vaultWeb.services.auth.AuthService;

@ExtendWith(MockitoExtension.class)
class DashboardControllerTest {

  @Mock private DashboardService dashboardService;

  @Mock private AuthService authService;

  @Mock private UserRepository userRepository;

  @InjectMocks private DashboardController dashboardController;

  @Test
  void shouldReturnDashboardForCurrentUser() {
    // Arrange
    User user = new User();

    UserDashboardDto dashboardDto =
        new UserDashboardDto(null, List.of(), List.of(), List.of(), List.of());

    when(authService.getCurrentUser()).thenReturn(user);
    when(dashboardService.buildDashboard(user)).thenReturn(dashboardDto);

    // Act
    ResponseEntity<UserDashboardDto> response = dashboardController.getCurrentUserDashboard();

    // Assert
    assertEquals(HttpStatus.OK, response.getStatusCode());
    assertEquals(dashboardDto, response.getBody());
  }

  @Test
  void shouldReturnDashboardForSpecificUser_WhenRequestingOwnUsername() {
    // Arrange
    String username = "test_user";
    User user = new User();
    user.setUsername(username);

    UserDashboardDto dashboardDto =
        new UserDashboardDto(null, List.of(), List.of(), List.of(), List.of());

    when(authService.getCurrentUser()).thenReturn(user);
    when(userRepository.findByUsername(username)).thenReturn(Optional.of(user));
    when(dashboardService.buildDashboard(user)).thenReturn(dashboardDto);

    // Act
    ResponseEntity<UserDashboardDto> response = dashboardController.getDashboardForUser(username);

    // Assert
    assertEquals(HttpStatus.OK, response.getStatusCode());
    assertEquals(dashboardDto, response.getBody());
  }

  @Test
  void shouldRejectDashboard_WhenRequestingAnotherUsersUsername() {
    // Regression test for #342: an authenticated user must not be able to view
    // another user's dashboard by requesting GET /api/dashboard/{their-username}.
    User mallory = new User();
    mallory.setUsername("mallory");

    when(authService.getCurrentUser()).thenReturn(mallory);

    assertThrows(
        AccessDeniedException.class, () -> dashboardController.getDashboardForUser("alice"));
    verify(userRepository, never()).findByUsername(any());
    verify(dashboardService, never()).buildDashboard(any());
  }

  @Test
  void shouldRejectDashboard_WhenUnauthenticated() {
    when(authService.getCurrentUser()).thenReturn(null);

    assertThrows(
        UnauthorizedException.class, () -> dashboardController.getDashboardForUser("alice"));
    verify(userRepository, never()).findByUsername(any());
    verify(dashboardService, never()).buildDashboard(any());
  }

  @Test
  void shouldThrowUserNotFound_WhenOwnUsernameLookupFails() {
    // Edge case: currentUser passes the self-check but the repository lookup for
    // that same username somehow misses (stale session, race with deletion, etc.).
    String username = "test_user";
    User user = new User();
    user.setUsername(username);

    when(authService.getCurrentUser()).thenReturn(user);
    when(userRepository.findByUsername(username)).thenReturn(Optional.empty());

    assertThrows(
        UserNotFoundException.class, () -> dashboardController.getDashboardForUser(username));
  }
}
