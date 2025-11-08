import { Box, Button, Card, Container, Flex, Theme } from '@radix-ui/themes';
 import '@radix-ui/themes/styles.css';
 import { HeadContent, Link, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
 import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
 import { Suspense } from 'react';
 import { getAuth, getSignInUrl } from '../authkit/serverFunctions';
 import Footer from '../components/footer';
 import SignInButton from '../components/sign-in-button';
 import type { ReactNode } from 'react';

 export const Route = createRootRoute({
 beforeLoad: async () => {
 const { user } = await getAuth();

 return { user };
 },
 head: () => ({
 meta: [
 {
 charSet: 'utf-8',
 },
 {
 name: 'viewport',
 content: 'width=device-width, initial-scale=1',
 },
 {
 title: 'AuthKit Example in TanStack Start',
 },
 ],
 }),
 loader: async ({ context }) => {
 const { user } = context;
 const url = await getSignInUrl();
 return {
 user,
 url,
 };
 },
 component: RootComponent,
 notFoundComponent: () => Not Found,
 });

 function RootComponent() {
 const { user, url } = Route.useLoaderData();
 return (











 Home



 Account



 Loading...}>



















 );
 }

 function RootDocument({ children }: Readonly) {
 return (





 {children}



 );
 }



 import { Box, Button, Card, Container, Flex, Theme } from '@radix-ui/themes';
 import '@radix-ui/themes/styles.css';
 import { HeadContent, Link, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
 import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
 import { Suspense } from 'react';
 import { getAuth, getSignInUrl } from '../authkit/serverFunctions';
 import Footer from '../components/footer';
 import SignInButton from '../components/sign-in-button';
 import type { ReactNode } from 'react';

 export const Route = createRootRoute({
 beforeLoad: async () => {
 const { user } = await getAuth();

 return { user };
 },
 head: () => ({
 meta: [
 {
 charSet: 'utf-8',
 },
 {
 name: 'viewport',
 content: 'width=device-width, initial-scale=1',
 },
 {
 title: 'AuthKit Example in TanStack Start',
 },
 ],
 }),
 loader: async ({ context }) => {
 const { user } = context;
 const url = await getSignInUrl();
 return {
 user,
 url,
 };
 },
 component: RootComponent,
 notFoundComponent: () => Not Found,
 });

 function RootComponent() {
 const { user, url } = Route.useLoaderData();
 return (











 Home



 Account



 Loading...}>



















 );
 }

 function RootDocument({ children }: Readonly) {
 return (





 {children}



 );
 }