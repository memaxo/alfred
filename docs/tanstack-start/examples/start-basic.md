import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
 import type { User } from '../utils/users'

 export const Route = createFileRoute('/users')({
 loader: async () => {
 const res = await fetch('/api/users')

 if (!res.ok) {
 throw new Error('Unexpected status code')
 }

 const data = await res.json()

 return data as Array
 },
 component: UsersComponent,
 })

 function UsersComponent() {
 const users = Route.useLoaderData()

 return (


 {[
 ...users,
 { id: 'i-do-not-exist', name: 'Non-existent User', email: '' },
 ].map((user) => {
 return (


 {user.name}


 )
 })}




 )
 }



 import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
 import type { User } from '../utils/users'

 export const Route = createFileRoute('/users')({
 loader: async () => {
 const res = await fetch('/api/users')

 if (!res.ok) {
 throw new Error('Unexpected status code')
 }

 const data = await res.json()

 return data as Array
 },
 component: UsersComponent,
 })

 function UsersComponent() {
 const users = Route.useLoaderData()

 return (


 {[
 ...users,
 { id: 'i-do-not-exist', name: 'Non-existent User', email: '' },
 ].map((user) => {
 return (


 {user.name}


 )
 })}




 )
 }