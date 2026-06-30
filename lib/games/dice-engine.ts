export function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

export function determineDiceWinner(
  playerOneRoll: number,
  playerTwoRoll: number,
) {
  if (playerOneRoll === playerTwoRoll) {
    return "draw";
  }

  return playerOneRoll > playerTwoRoll ? "player1" : "player2";
}
