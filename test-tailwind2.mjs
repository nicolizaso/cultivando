import fs from 'fs';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';

const css = `
@import "tailwindcss";

@theme {
  --color-black: #000;
}

.test {
  @apply dark:bg-black;
}
`;

postcss([tailwindcss]).process(css, { from: 'globals.css' }).then(result => {
  console.log("SUCCESS");
  console.log(result.css);
}).catch(err => console.error(err));
