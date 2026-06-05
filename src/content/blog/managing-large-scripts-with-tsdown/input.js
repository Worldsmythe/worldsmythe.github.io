const modifier = ({ text }) => {
  text = DiceRoll.Hooks.Input(text);
  return { text };
};

modifier(text);
