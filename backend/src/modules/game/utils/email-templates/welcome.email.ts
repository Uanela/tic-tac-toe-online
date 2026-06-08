import { EmailTemplateResult } from "./invintations.email";

export function welcomeEmail(player: {
  nickname: string;
}): EmailTemplateResult {
  return {
    subject: `Seja muito bem-vindo(a) à Arkos Games, ${player.nickname}! 🚀`,
    html: `<p>Olá, ${player.nickname}! Seja muito bem-vindo(a) à Arkos Games! 🎮</p>

<p>Estamos muito empolgados em ter você na nossa comunidade. O seu cadastro foi concluído com sucesso e o tabuleiro de X e O (Jogo da Velha) já está pronto para a sua estreia!</p>

<p>Aqui você pode desafiar seus amigos, enfrentar jogadores online e testar suas melhores estratégias para subir no ranking.</p>

🕹️ <b>Pronto para a sua primeira partida?</b>

<p>Não perca tempo! Clique no link abaixo, entre no jogo e faça a sua jogada de estreia:</p>

<p>👉 <a href="https://games.arkosjs.com/play">Clique aqui para começar a jogar</a></p>

<p>💡 <b>Dica de mestre:</b> Você pode criar salas personalizadas no nosso site e enviar o link direto para os seus amigos se divertirem com você.</p>

<p>Mais uma vez, seja bem-vindo. Nos vemos no tabuleiro!</p>

<p>Boa sorte e divirta-se,</p>

<p>Equipe Arkos Games</p>`,
  };
}
