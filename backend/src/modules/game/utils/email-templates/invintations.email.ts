export interface EmailTemplateResult {
  subject: string;
  html: string;
}

export function morningInviteEmail(player: {
  nickname: string;
}): EmailTemplateResult {
  return {
    subject: `Bom dia, ${player.nickname}! ☕ Hora de aquecer o cérebro no X e O`,
    html: `<p>Bom dia, ${player.nickname}! ☕</p>

<p>Nada melhor do que começar o dia ativando o cérebro com uma vitória! O café já está na xícara? Então o tabuleiro de X e O está te esperando.</p>

<p>Vem garantir a sua primeira vitória do dia antes da rotina apertar! 😉</p>

🕹️ <b>Sua primeira partida te espera:</b>

<p>Para jogar agora mesmo, basta clicar no link abaixo:</p>

<p>👉 <a href="https://games.arkosjs.com/play">Clique aqui para entrar no jogo</a></p>

<p>⏳ <b>Aviso:</b> Os adversários já estão online. Não deixe o topo do ranking esperando por você!</p>

<p>Boa sorte e divirta-se,</p>

<p>Equipe Arkos Games</p>`,
  };
}

export function lunchInviteEmail(player: {
  nickname: string;
}): EmailTemplateResult {
  return {
    subject: `Hora do almoço, ${player.nickname}? 🍕 Bateu aquela fome de vitória?`,
    html: `<p>Olá, ${player.nickname}! Hora do almoço? 🍕</p>

<p>Bateu aquela fome... de vitória? A sua pausa para o almoço combina perfeitamente com uma partidinha rápida de X e O para descontrair a mente.</p>

<p>É o tempo do prato chegar ou de fazer a digestão mostrando quem manda no jogo! 😎</p>

🕹️ <b>Aproveite a sua pausa:</b>

<p>Clique no link abaixo para entrar em uma partida rápida:</p>

<p>👉 <a href="https://games.arkosjs.com/play">Clique aqui para jogar agora</a></p>

<p>⏳ <b>Aviso:</b> Uma partida rápida dura poucos minutos, mas a sensação de ganhar dura o dia todo!</p>

<p>Boa sorte e divirta-se,</p>

<p>Equipe Arkos Games</p>`,
  };
}

export function eveningInviteEmail(player: {
  nickname: string;
}): EmailTemplateResult {
  return {
    subject: `Boa noite, ${player.nickname}! 🌌 Bora fechar o dia com chave de ouro?`,
    html: `<p>Boa noite, ${player.nickname}! 🌌</p>

<p>O dia foi corrido, mas agora é o momento de relaxar. Que tal fechar a sua noite com chave de ouro e garantir algumas vitórias no X e O?</p>

<p>O clima no tabuleiro está perfeito para um jogo estratégico e divertido antes de descansar. ⚔️</p>

🕹️ <b>Hora do jogo:</b>

<p>Acesse o link abaixo e mostre que você é o mestre da noite:</p>

<p>👉 <a href="https://games.arkosjs.com/play">Clique aqui para entrar no tabuleiro</a></p>

<p>⏳ <b>Aviso:</b> Os melhores jogadores costumam se enfrentar a esta hora. Vai encarar o desafio?</p>

<p>Boa sorte e divirta-se,</p>

<p>Equipe Arkos Games</p>`,
  };
}
