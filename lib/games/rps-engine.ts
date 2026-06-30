export type RPSChoice = "rock" | "paper" | "scissors";

export function determineRPSWinner(playerOne: RPSChoice, playerTwo: RPSChoice) {
  if (playerOne === playerTwo) {
    return "draw";
  }

  if (
    (playerOne === "rock" && playerTwo === "scissors") ||
    (playerOne === "paper" && playerTwo === "rock") ||
    (playerOne === "scissors" && playerTwo === "paper")
  ) {
    return "player1";
  }

  return "player2";
}
