/**
 * Pages within a user's profile. The values for these match the path in the route as well.
 */
export enum UserProfileSubPage {
  /**
   * A summary page, displaying a basic overview of the player, such as their wins and losses, a
   * brief match history, etc.
   */
  Summary = 'summary',
  /**
   * A page of detailed statistics about the player.
   */
  Stats = 'stats',
  /**
   * The full match history of the player.
   */
  MatchHistory = 'match-history',
  /**
   * Statistics for the player broken down by matchmaking season.
   */
  Seasons = 'seasons',
}
