# Guia de Instalação e Troca de Nome do FlexBot no Discord

Este documento fornece o **link oficial de convite/instalação** do FlexBot e as instruções para alterar o nome de exibição da aplicação de `gusta-bot` para **`FlexBot`** no Discord Developer Portal.

---

## 🏷️ 1. Como Alterar o Nome de "gusta-bot" para "FlexBot" no Discord

O nome exibido na tela de autorização do Discord é controlado diretamente no **Discord Developer Portal** associado ao seu `CLIENT_ID (1534658355228967042)`:

### Passo a Passo para Alterar o Nome:

1. Acesse o **Discord Developer Portal**:
   👉 [https://discord.com/developers/applications](https://discord.com/developers/applications)
2. Faça login e clique na sua aplicação (`Client ID: 1534658355228967042`).
3. Na aba **General Information** (Informações Gerais):
   - Altere o campo **NAME** de `gusta-bot` para **`FlexBot`** (ou `FlexBot Rio`).
   - *(Opcional)* Faça o upload da logo/avatar oficial da Prefeitura do Rio.
   - Clique em **Save Changes** (Salvar Alterações).
4. No menu lateral esquerdo, clique na aba **Bot**:
   - Altere o campo **USERNAME** de `gusta-bot` para **`FlexBot`**.
   - Clique em **Save Changes** (Salvar Alterações).

> ✨ **Pronto!** Assim que você salvar no Portal do Desenvolvedor, o Discord atualizará instantaneamente o nome na tela de convite para **FlexBot**.

---

## 🔗 2. Link Oficial de Instalação no Discord

Para adicionar o FlexBot ao seu servidor do Discord com todas as permissões necessárias para gerenciar cargos e interagir via comandos Slash e DMs, utilize o link abaixo:

### ➔ [Clique Aqui para Instalar o FlexBot no seu Servidor Discord](https://discord.com/api/oauth2/authorize?client_id=1534658355228967042&permissions=268435456&scope=bot%20applications.commands)

**URL de Convite Direct (Copiar e Colar):**
```
https://discord.com/api/oauth2/authorize?client_id=1534658355228967042&permissions=268435456&scope=bot%20applications.commands
```

---

## ⚠️ 3. Ajuste Obrigatório de Hierarquia de Cargos (IMPORTANTE!)

Após adicionar o FlexBot ao servidor, você **DEVE** realizar esta configuração no Discord para que a atribuição de cargos funcione:

1. Abra o Discord e acesse **Configurações do Servidor** -> **Cargos**.
2. Procure o cargo do bot: **`FlexBot`**.
3. **Arraste o cargo do FlexBot para o TOPO da lista** (ou pelo menos para cima dos cargos que o bot precisará atribuir aos usuários).
4. Clique em **Salvar Alterações**.
