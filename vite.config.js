import { defineConfig } from 'vite';
export default defineConfig({
 root:'dist',
 // Relative URLs support both username.github.io/ and username.github.io/repository/.
 base:'./',
 build:{outDir:'../build',emptyOutDir:true,target:'es2022',assetsInlineLimit:0},
 server:{host:'0.0.0.0',allowedHosts:['terminal.local']}
});
