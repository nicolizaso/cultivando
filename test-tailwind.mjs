import fs from 'fs';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';

const css = `
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

.test {
  @apply dark:bg-black;
}
`;

postcss([tailwindcss]).process(css, { from: 'globals.css' }).then(result => {
  console.log("SUCCESS");
  console.log(result.css.includes('.dark'));
}).catch(err => console.error(err));
