package vaultWeb.repositories;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vaultWeb.models.PrivateChat;
import vaultWeb.models.User;

public interface PrivateChatRepository extends JpaRepository<PrivateChat, Long> {
  Optional<PrivateChat> findByUser1AndUser2(User user1, User user2);

  Optional<PrivateChat> findByUser2AndUser1(User user1, User user2);

  List<PrivateChat> findByUser1OrUser2(User user1, User user2);

  @Query(
      "SELECT CASE WHEN COUNT(pc) > 0 THEN true ELSE false END FROM PrivateChat pc "
          + "WHERE pc.id = :id AND (pc.user1.username = :username OR pc.user2.username = :username)")
  boolean existsByIdAndParticipantUsername(
      @Param("id") Long id, @Param("username") String username);
}
