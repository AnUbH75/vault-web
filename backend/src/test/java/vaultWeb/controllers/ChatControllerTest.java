package vaultWeb.controllers;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.security.Principal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import vaultWeb.dtos.ChatMessageDto;
import vaultWeb.exceptions.UnauthorizedException;
import vaultWeb.models.ChatMessage;
import vaultWeb.models.Group;
import vaultWeb.models.PrivateChat;
import vaultWeb.models.User;
import vaultWeb.repositories.GroupMemberRepository;
import vaultWeb.repositories.PrivateChatRepository;
import vaultWeb.services.ChatService;

@ExtendWith(MockitoExtension.class)
class ChatControllerTest {

  private static final String SENDER_DEVICE_ID = "device-1";
  private static final String E2EE_PAYLOAD = "{\"v\":2}";

  @Mock private SimpMessagingTemplate messagingTemplate;

  @Mock private ChatService chatService;

  @Mock private GroupMemberRepository groupMemberRepository;

  @Mock private PrivateChatRepository privateChatRepository;

  @InjectMocks private ChatController chatController;

  @Test
  void shouldSendGroupMessage_WhenAuthenticatedUserIsGroupMember() {
    ChatMessageDto request = createGroupMessageRequest(10L);
    Principal principal = () -> "alice";
    ChatMessage savedMessage = createSavedGroupMessage(10L, "alice");
    ChatMessageDto response = createGroupMessageRequest(10L);
    response.setSenderUsername("alice");

    when(groupMemberRepository.existsByGroupIdAndUserUsername(10L, "alice")).thenReturn(true);
    when(chatService.saveMessage(any(ChatMessageDto.class))).thenReturn(savedMessage);
    when(chatService.toDto(savedMessage)).thenReturn(response);

    chatController.sendMessage(request, principal);

    ArgumentCaptor<ChatMessageDto> dtoCaptor = ArgumentCaptor.forClass(ChatMessageDto.class);
    verify(chatService).saveMessage(dtoCaptor.capture());
    assertEquals("alice", dtoCaptor.getValue().getSenderUsername());
    verify(messagingTemplate).convertAndSend(eq("/topic/group/10"), any(ChatMessageDto.class));
  }

  @Test
  void shouldRejectGroupMessage_WhenAuthenticatedUserIsNotGroupMember() {
    ChatMessageDto request = createGroupMessageRequest(10L);
    Principal principal = () -> "mallory";

    when(groupMemberRepository.existsByGroupIdAndUserUsername(10L, "mallory")).thenReturn(false);

    assertThrows(AccessDeniedException.class, () -> chatController.sendMessage(request, principal));
    verify(chatService, never()).saveMessage(any());
    verify(messagingTemplate, never()).convertAndSend(any(String.class), any(ChatMessageDto.class));
  }

  @Test
  void shouldRejectGroupMessage_WhenUnauthenticated() {
    ChatMessageDto request = createGroupMessageRequest(10L);

    assertThrows(UnauthorizedException.class, () -> chatController.sendMessage(request, null));
    verify(groupMemberRepository, never()).existsByGroupIdAndUserUsername(any(), any());
    verify(chatService, never()).saveMessage(any());
    verify(messagingTemplate, never()).convertAndSend(any(String.class), any(ChatMessageDto.class));
  }

  @Test
  void shouldSendPrivateMessage_WhenAuthenticatedUserIsParticipant() {
    ChatMessageDto request = createPrivateMessageRequest(20L);
    Principal principal = () -> "alice";
    ChatMessage savedMessage = createSavedPrivateMessage(20L, "alice", "bob");
    ChatMessageDto response = createPrivateMessageRequest(20L);
    response.setSenderUsername("alice");

    when(privateChatRepository.existsByIdAndParticipantUsername(20L, "alice")).thenReturn(true);
    when(chatService.saveMessage(any(ChatMessageDto.class))).thenReturn(savedMessage);
    when(chatService.toDto(savedMessage)).thenReturn(response);

    chatController.sendPrivateMessage(request, principal);

    ArgumentCaptor<ChatMessageDto> dtoCaptor = ArgumentCaptor.forClass(ChatMessageDto.class);
    verify(chatService).saveMessage(dtoCaptor.capture());
    assertEquals("alice", dtoCaptor.getValue().getSenderUsername());
    verify(messagingTemplate)
        .convertAndSendToUser(eq("alice"), eq("/queue/private"), any(ChatMessageDto.class));
    verify(messagingTemplate)
        .convertAndSendToUser(eq("bob"), eq("/queue/private"), any(ChatMessageDto.class));
  }

  @Test
  void shouldRejectPrivateMessage_WhenAuthenticatedUserIsNotParticipant() {
    // Mallory is not a participant of private chat 20 (alice/bob), and attempts to
    // inject a message while spoofing "alice" as the sender in the payload.
    ChatMessageDto request = createPrivateMessageRequest(20L);
    Principal principal = () -> "mallory";

    when(privateChatRepository.existsByIdAndParticipantUsername(20L, "mallory")).thenReturn(false);

    assertThrows(
        AccessDeniedException.class, () -> chatController.sendPrivateMessage(request, principal));
    verify(chatService, never()).saveMessage(any());
    verify(messagingTemplate, never())
        .convertAndSendToUser(any(String.class), any(String.class), any(ChatMessageDto.class));
  }

  @Test
  void shouldRejectPrivateMessage_WhenUnauthenticated() {
    ChatMessageDto request = createPrivateMessageRequest(20L);

    assertThrows(
        UnauthorizedException.class, () -> chatController.sendPrivateMessage(request, null));
    verify(privateChatRepository, never()).existsByIdAndParticipantUsername(any(), any());
    verify(chatService, never()).saveMessage(any());
    verify(messagingTemplate, never())
        .convertAndSendToUser(any(String.class), any(String.class), any(ChatMessageDto.class));
  }

  @Test
  void shouldOverwriteSenderUsername_WithPrincipalName_NotSpoofedPayloadValue() {
    // request carries a spoofed sender ("spoofed-sender" from the helper); confirm the
    // dto passed to saveMessage carries the authenticated principal's name instead.
    ChatMessageDto request = createPrivateMessageRequest(20L);
    Principal principal = () -> "alice";
    ChatMessage savedMessage = createSavedPrivateMessage(20L, "alice", "bob");
    ChatMessageDto response = createPrivateMessageRequest(20L);
    response.setSenderUsername("alice");

    when(privateChatRepository.existsByIdAndParticipantUsername(20L, "alice")).thenReturn(true);
    when(chatService.saveMessage(any(ChatMessageDto.class))).thenReturn(savedMessage);
    when(chatService.toDto(savedMessage)).thenReturn(response);

    chatController.sendPrivateMessage(request, principal);

    ArgumentCaptor<ChatMessageDto> dtoCaptor = ArgumentCaptor.forClass(ChatMessageDto.class);
    verify(chatService).saveMessage(dtoCaptor.capture());
    assertEquals("alice", dtoCaptor.getValue().getSenderUsername());
    assertEquals(null, dtoCaptor.getValue().getSenderId());
  }

  private ChatMessageDto createGroupMessageRequest(Long groupId) {
    ChatMessageDto dto = new ChatMessageDto();
    dto.setGroupId(groupId);
    dto.setSenderUsername("spoofed-sender");
    dto.setSenderDeviceId(SENDER_DEVICE_ID);
    dto.setE2eePayload(E2EE_PAYLOAD);
    return dto;
  }

  private ChatMessageDto createPrivateMessageRequest(Long privateChatId) {
    ChatMessageDto dto = new ChatMessageDto();
    dto.setPrivateChatId(privateChatId);
    dto.setSenderUsername("spoofed-sender");
    dto.setSenderDeviceId(SENDER_DEVICE_ID);
    dto.setE2eePayload(E2EE_PAYLOAD);
    return dto;
  }

  private ChatMessage createSavedGroupMessage(Long groupId, String username) {
    User sender = new User();
    sender.setUsername(username);
    Group group = new Group();
    group.setId(groupId);
    ChatMessage message = new ChatMessage();
    message.setGroup(group);
    message.setSender(sender);
    message.setSenderDeviceId(SENDER_DEVICE_ID);
    message.setE2eePayload(E2EE_PAYLOAD);
    message.setTimestamp(java.time.Instant.parse("2026-03-26T10:15:30Z"));
    return message;
  }

  private ChatMessage createSavedPrivateMessage(
      Long privateChatId, String user1Username, String user2Username) {
    User user1 = new User();
    user1.setUsername(user1Username);
    User user2 = new User();
    user2.setUsername(user2Username);
    PrivateChat privateChat = new PrivateChat();
    privateChat.setId(privateChatId);
    privateChat.setUser1(user1);
    privateChat.setUser2(user2);

    User sender = new User();
    sender.setUsername(user1Username);

    ChatMessage message = new ChatMessage();
    message.setPrivateChat(privateChat);
    message.setSender(sender);
    message.setSenderDeviceId(SENDER_DEVICE_ID);
    message.setE2eePayload(E2EE_PAYLOAD);
    message.setTimestamp(java.time.Instant.parse("2026-03-26T10:15:30Z"));
    return message;
  }
}
