export default function challengeEmail(
  player: { nickname: string },
  opponent: { nickname: string },
  inviteId: string
): string {
  return `<p>Olá, ${opponent.nickname},</p>

<p>O clima esquentou no tabuleiro! O jogador ${player.nickname} acabou de te desafiar para uma partida imperdível de X e O (Jogo da Velha).</p>

<p>Será que você tem a estratégia certa para vencer ou vai deixar a vitória escapar? 😉</p>

🕹️ <b>Como entrar na partida</b>:

<p>Para aceitar o desafio e começar a jogar agora mesmo, basta clicar no link abaixo:</p>

<p>👉 <a href="https://games.arkosjs.com/play?inviteId=${inviteId}">Clique aqui para jogar agora</a></p>

<p>⏳ <b>Aviso:</b> Não deixe seu adversário esperando! Acesse o link e mostre quem manda no tabuleiro.</p>

<p>Boa sorte e divirta-se,</p>

<p>Equipe Arkos Games</p>`;
}
