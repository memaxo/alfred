///
 import {
 ClerkProvider,
 SignInButton,
 SignedIn,
 SignedOut,
 UserButton,
 } from '@clerk/tanstack-react-start'
 import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
 import { createServerFn } from '@tanstack/react-start'
 import { auth } from '@clerk/tanstack-react-start/server'
 import * as React from 'react'
 import {
 HeadContent,
 Link,
 Outlet,
 Scripts,
 createRootRoute,
 } from '@tanstack/react-router'
 import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary.js'
 import { NotFound } from '~/components/NotFound.js'
 import appCss from '~/styles/app.css?url'

 const fetchClerkAuth = createServerFn({ method: 'GET' }).handler(async () => {
 const { userId } = await auth()

 return {
 userId,
 }
 })

 export const Route = createRootRoute({
 beforeLoad: async () => {
 const { userId } = await fetchClerkAuth()

 return {
 userId,
 }
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
 ],
 links: [
 { rel: 'stylesheet', href: appCss },
 {
 rel: 'apple-touch-icon',
 sizes: '180x180',
 href: '/apple-touch-icon.png',
 },
 {
 rel: 'icon',
 type: 'image/png',
 sizes: '32x32',
 href: '/favicon-32x32.png',
 },
 {
 rel: 'icon',
 type: 'image/png',
 sizes: '16x16',
 href: '/favicon-16x16.png',
 },
 { rel: 'manifest', href: '/site.webmanifest', color: '#fffff' },
 { rel: 'icon', href: '/favicon.ico' },
 ],
 }),
 errorComponent: (props) => {
 return (



 )
 },
 notFoundComponent: () => ,
 component: RootComponent,
 })

 function RootComponent() {
 return (





 )
 }

 function RootDocument({ children }: { children: React.ReactNode }) {
 return (







 Home
 {' '}

 Posts











 {children}




 )
 }



 ///
 import {
 ClerkProvider,
 SignInButton,
 SignedIn,
 SignedOut,
 UserButton,
 } from '@clerk/tanstack-react-start'
 import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
 import { createServerFn } from '@tanstack/react-start'
 import { auth } from '@clerk/tanstack-react-start/server'
 import * as React from 'react'
 import {
 HeadContent,
 Link,
 Outlet,
 Scripts,
 createRootRoute,
 } from '@tanstack/react-router'
 import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary.js'
 import { NotFound } from '~/components/NotFound.js'
 import appCss from '~/styles/app.css?url'

 const fetchClerkAuth = createServerFn({ method: 'GET' }).handler(async () => {
 const { userId } = await auth()

 return {
 userId,
 }
 })

 export const Route = createRootRoute({
 beforeLoad: async () => {
 const { userId } = await fetchClerkAuth()

 return {
 userId,
 }
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
 ],
 links: [
 { rel: 'stylesheet', href: appCss },
 {
 rel: 'apple-touch-icon',
 sizes: '180x180',
 href: '/apple-touch-icon.png',
 },
 {
 rel: 'icon',
 type: 'image/png',
 sizes: '32x32',
 href: '/favicon-32x32.png',
 },
 {
 rel: 'icon',
 type: 'image/png',
 sizes: '16x16',
 href: '/favicon-16x16.png',
 },
 { rel: 'manifest', href: '/site.webmanifest', color: '#fffff' },
 { rel: 'icon', href: '/favicon.ico' },
 ],
 }),
 errorComponent: (props) => {
 return (



 )
 },
 notFoundComponent: () => ,
 component: RootComponent,
 })

 function RootComponent() {
 return (





 )
 }

 function RootDocument({ children }: { children: React.ReactNode }) {
 return (







 Home
 {' '}

 Posts











 {children}




 )
 }