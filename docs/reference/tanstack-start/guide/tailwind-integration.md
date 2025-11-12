_So you want to use Tailwind CSS in your TanStack Start project?_

This guide will help you use Tailwind CSS in your TanStack Start project.

Tailwind CSS Version 4 (Latest)

The latest version of Tailwind CSS is 4. And it has some configuration changes that majorly differ from Tailwind CSS Version 3. It's **easier and recommended** to set up Tailwind CSS Version 4 in a TanStack Start project, as TanStack Start uses Vite as its build tool.

Install Tailwind CSS

Install Tailwind CSS and it's Vite plugin.


 npm install tailwindcss @tailwindcss/vite



 npm install tailwindcss @tailwindcss/vite


Configure The Vite Plugin

Add the @tailwindcss/vite plugin to your Vite configuration.


 // vite.config.ts
 import { defineConfig } from 'vite'
 import tsConfigPaths from 'vite-tsconfig-paths'
 import { tanstackStart } from '@tanstack/react-start/plugin/vite'
 import tailwindcss from '@tailwindcss/vite'
 import viteReact from '@vitejs/plugin-react'

 export default defineConfig({
 server: {
 port: 3000,
 },
 plugins: [tsConfigPaths(), tanstackStart(), viteReact(), tailwindcss()],
 })



 // vite.config.ts
 import { defineConfig } from 'vite'
 import tsConfigPaths from 'vite-tsconfig-paths'
 import { tanstackStart } from '@tanstack/react-start/plugin/vite'
 import tailwindcss from '@tailwindcss/vite'
 import viteReact from '@vitejs/plugin-react'

 export default defineConfig({
 server: {
 port: 3000,
 },
 plugins: [tsConfigPaths(), tanstackStart(), viteReact(), tailwindcss()],
 })


Import Tailwind in your CSS file

You need to create a CSS file to configure Tailwind CSS instead of the configuration file in version 4. You can do this by creating a src/styles/app.css file or name it whatever you want.


 /* src/styles/app.css */
 @import 'tailwindcss';



 /* src/styles/app.css */
 @import 'tailwindcss';


Import the CSS file in your __root.tsx file

Import the CSS file in your __root.tsx file with the ?url query and make sure to add the **triple slash** directive to the top of the file.


 // src/routes/__root.tsx
 ///
 // other imports...

 import appCss from '../styles/app.css?url'

 export const Route = createRootRoute({
 head: () => ({
 meta: [
 // your meta tags and site config
 ],
 links: [{ rel: 'stylesheet', href: appCss }],
 // other head config
 }),
 component: RootComponent,
 })



 // src/routes/__root.tsx
 ///
 // other imports...

 import appCss from '../styles/app.css?url'

 export const Route = createRootRoute({
 head: () => ({
 meta: [
 // your meta tags and site config
 ],
 links: [{ rel: 'stylesheet', href: appCss }],
 // other head config
 }),
 component: RootComponent,
 })


Use Tailwind CSS anywhere in your project

You can now use Tailwind CSS anywhere in your project.


 // src/routes/index.tsx
 import { createFileRoute } from '@tanstack/react-router'

 export const Route = createFileRoute('/')({
 component: Home,
 })

 function Home() {
 return Hello World
 }



 // src/routes/index.tsx
 import { createFileRoute } from '@tanstack/react-router'

 export const Route = createFileRoute('/')({
 component: Home,
 })

 function Home() {
 return Hello World
 }


That's it! You can now use Tailwind CSS anywhere in your project 🎉.

Tailwind CSS Version 3 (Legacy)

If you are want to use Tailwind CSS Version 3, you can use the following steps.

Install Tailwind CSS

Install Tailwind CSS and it's peer dependencies.


 npm install -D tailwindcss@3 postcss autoprefixer



 npm install -D tailwindcss@3 postcss autoprefixer


Then generate the Tailwind and PostCSS configuration files.


 npx tailwindcss init -p



 npx tailwindcss init -p


Configure your template paths

Add the paths to all of your template files in the tailwind.config.js file.


 // tailwind.config.js
 /** @type {import('tailwindcss').Config} */
 export default {
 content: ['./src/**/*.{js,ts,jsx,tsx}'],
 theme: {
 extend: {},
 },
 plugins: [],
 }



 // tailwind.config.js
 /** @type {import('tailwindcss').Config} */
 export default {
 content: ['./src/**/*.{js,ts,jsx,tsx}'],
 theme: {
 extend: {},
 },
 plugins: [],
 }


Add the Tailwind directives to your CSS file

Add the @tailwind directives for each of Tailwind's layers to your src/styles/app.css file.


 /* src/styles/app.css */
 @tailwind base;
 @tailwind components;
 @tailwind utilities;



 /* src/styles/app.css */
 @tailwind base;
 @tailwind components;
 @tailwind utilities;