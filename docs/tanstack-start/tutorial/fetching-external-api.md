This guide demonstrates how to integrate external API calls into your TanStack Start application using route loaders. We will use TMDB API to fetch popular movies using TanStack Start and understand how to fetch data in a TanStack Start app.

The complete code for this tutorial is available on GitHub.

What You'll Learn

 1. Setting up external API integration with TanStack Start
 2. Implementing route loaders for server-side data fetching
 3. Building responsive UI components with fetched data
 4. Handling loading states and error management

Prerequisites

 * Basic knowledge of React and TypeScript
 * Node.js (v18+) and pnpm installed on your machine
 * A TMDB API key (free at themoviedb.org)

Nice to know Setting up a TanStack Start Project

First, let's create a new TanStack Start project:


 pnpx create-start-app movie-discovery
 cd movie-discovery



 pnpx create-start-app movie-discovery
 cd movie-discovery


When this script runs, it will ask you a few setup questions. You can either pick choices that work for you or just press enter to accept the defaults.

Optionally, you can pass in a \--add-on flag to get options such as Shadcn, Clerk, Convex, TanStack Query, etc.

Once setup is complete, install dependencies and start the development server:


 pnpm i
 pnpm dev



 pnpm i
 pnpm dev


Understanding the Project Structure

At this point, the project structure should look like this:


 /movie-discovery
 ├── src/
 │ ├── routes/
 │ │ ├── __root.tsx # Root layout
 │ │ ├── index.tsx # Home page
 │ │ └── fetch-movies.tsx # Movie fetching route
 │ ├── types/
 │ │ └── movie.ts # Movie type definitions
 │ ├── router.tsx # Router configuration
 │ ├── routeTree.gen.ts # Generated route tree
 │ └── styles.css # Global styles
 ├── public/ # Static assets
 ├── vite.config.ts # TanStack Start configuration
 ├── package.json # Project dependencies
 └── tsconfig.json # TypeScript configuration



 /movie-discovery
 ├── src/
 │ ├── routes/
 │ │ ├── __root.tsx # Root layout
 │ │ ├── index.tsx # Home page
 │ │ └── fetch-movies.tsx # Movie fetching route
 │ ├── types/
 │ │ └── movie.ts # Movie type definitions
 │ ├── router.tsx # Router configuration
 │ ├── routeTree.gen.ts # Generated route tree
 │ └── styles.css # Global styles
 ├── public/ # Static assets
 ├── vite.config.ts # TanStack Start configuration
 ├── package.json # Project dependencies
 └── tsconfig.json # TypeScript configuration


Once your project is set up, you can access your app at localhost:3000. You should see the default TanStack Start welcome page.

Step 1: Setup a .env file with TMDB_AUTH_TOKEN

To fetch movies from the TMDB API, you need an authentication token. You can get this for free at themoviedb.org.

First, let's set up environment variables for our API key. Create a .env file in your project root:

Add your TMDB API token to this file:


 TMDB_AUTH_TOKEN=your_bearer_token_here



 TMDB_AUTH_TOKEN=your_bearer_token_here


_Important_ : Make sure to add .env to your .gitignore file to keep your API keys secure.

Step 2: Defining Data Types

Let's create TypeScript interfaces for our movie data. Create a new file at src/types/movie.ts:


 // src/types/movie.ts
 export interface Movie {
 id: number
 title: string
 overview: string
 poster_path: string | null
 backdrop_path: string | null
 release_date: string
 vote_average: number
 popularity: number
 }

 export interface TMDBResponse {
 page: number
 results: Movie[]
 total_pages: number
 total_results: number
 }



 // src/types/movie.ts
 export interface Movie {
 id: number
 title: string
 overview: string
 poster_path: string | null
 backdrop_path: string | null
 release_date: string
 vote_average: number
 popularity: number
 }

 export interface TMDBResponse {
 page: number
 results: Movie[]
 total_pages: number
 total_results: number
 }


Step 3: Creating the Route with API Fetch Function

Now let's create our route that fetches data from the TMDB API. Create a new file at src/routes/fetch-movies.tsx:


 // src/routes/fetch-movies.tsx
 import { createFileRoute } from '@tanstack/react-router'
 import type { Movie, TMDBResponse } from '../types/movie'

 const API_URL =
 'https://api.themoviedb.org/3/discover/movie?include_adult=false&include_video=false&language=en-US&page=1&sort_by=popularity.desc'

 async function fetchPopularMovies(): Promise {
 const token = process.env.TMDB_AUTH_TOKEN
 if (!token) {
 throw new Error('Missing TMDB_AUTH_TOKEN environment variable')
 }

 const response = await fetch(API_URL, {
 headers: {
 accept: 'application/json',
 Authorization: `Bearer ${token}`,
 },
 })

 if (!response.ok) {
 throw new Error(`Failed to fetch movies: ${response.statusText}`)
 }

 const data = (await response.json()) as TMDBResponse
 return data
 }

 export const Route = createFileRoute('/fetch-movies')({
 component: MoviesPage,
 loader: async (): Promise => {
 try {
 const moviesData = await fetchPopularMovies()
 return { movies: moviesData.results, error: null }
 } catch (error) {
 console.error('Error fetching movies:', error)
 return { movies: [], error: 'Failed to load movies' }
 }
 },
 })



 // src/routes/fetch-movies.tsx
 import { createFileRoute } from '@tanstack/react-router'
 import type { Movie, TMDBResponse } from '../types/movie'

 const API_URL =
 'https://api.themoviedb.org/3/discover/movie?include_adult=false&include_video=false&language=en-US&page=1&sort_by=popularity.desc'

 async function fetchPopularMovies(): Promise {
 const token = process.env.TMDB_AUTH_TOKEN
 if (!token) {
 throw new Error('Missing TMDB_AUTH_TOKEN environment variable')
 }

 const response = await fetch(API_URL, {
 headers: {
 accept: 'application/json',
 Authorization: `Bearer ${token}`,
 },
 })

 if (!response.ok) {
 throw new Error(`Failed to fetch movies: ${response.statusText}`)
 }

 const data = (await response.json()) as TMDBResponse
 return data
 }

 export const Route = createFileRoute('/fetch-movies')({
 component: MoviesPage,
 loader: async (): Promise => {
 try {
 const moviesData = await fetchPopularMovies()
 return { movies: moviesData.results, error: null }
 } catch (error) {
 console.error('Error fetching movies:', error)
 return { movies: [], error: 'Failed to load movies' }
 }
 },
 })


Step 4: Building the Movie Components

Now let's create the components that will display our movie data. Add these components to the same fetch-movies.tsx file:


 // MovieCard component
 const MovieCard = ({ movie }: { movie: Movie }) => {
 return (

 {movie.poster_path && (

 )}




 )
 }

 // MovieDetails component
 const MovieDetails = ({ movie }: { movie: Movie }) => {
 return (
 <>
 {movie.title}

 {movie.overview}


 {movie.release_date}

 ⭐️ {movie.vote_average.toFixed(1)}



 )
 }



 // MovieCard component
 const MovieCard = ({ movie }: { movie: Movie }) => {
 return (

 {movie.poster_path && (

 )}




 )
 }

 // MovieDetails component
 const MovieDetails = ({ movie }: { movie: Movie }) => {
 return (
 <>
 {movie.title}

 {movie.overview}


 {movie.release_date}

 ⭐️ {movie.vote_average.toFixed(1)}



 )
 }


Step 5: Creating the MoviesPage Component

Finally, let's create the main component that consumes the loader data:


 // MoviesPage component
 const MoviesPage = () => {
 const { movies, error } = Route.useLoaderData()()

 return (


 Popular Movies

 {error && (

 {error}

 )}

 {movies.length > 0 ? (

 {movies.slice(0, 12).map((movie) => (

 ))}

 ) : (
 !error && (

 Loading movies...

 )
 )}


 )
 }



 // MoviesPage component
 const MoviesPage = () => {
 const { movies, error } = Route.useLoaderData()()

 return (


 Popular Movies

 {error && (

 {error}

 )}

 {movies.length > 0 ? (

 {movies.slice(0, 12).map((movie) => (

 ))}

 ) : (
 !error && (

 Loading movies...

 )
 )}


 )
 }


Understanding How It All Works Together

Let's break down how the different parts of our application work together:

 1. Route loader: When a user visits /fetch-movies, the loader function runs on the server
 2. API call: The loader calls fetchPopularMovies() which makes an HTTP request to TMDB
 3. Server-Side rendering: The data is fetched on the server reducing the load on the client side
 4. Component rendering: The MoviesPage component receives the data via Route.useLoaderData()
 5. Rendering UI: The movie cards are rendered with the fetched data

Step 6: Testing Your Application

Now you can test your application by visiting . If everything is set up correctly, you should see a grid of popular movies with their posters, titles, and ratings. Your app should look like this:

!Netflix style movie setup

Conclusion

You've successfully built a movie discovery app that integrates with an external API using TanStack Start. This tutorial demonstrated how to use route loaders for server-side data fetching and building UI components with external data.

While fetching data at build time in TanStack Start is perfect for static content like blog posts or product pages, it's not ideal for interactive apps. If you need features like real-time updates, caching, or infinite scrolling, you'll want to use TanStack Query on the client side instead. TanStack Query makes it easy to handle dynamic data with built-in caching, background updates, and smooth user interactions. By using TanStack Start for static content and TanStack Query for interactive features, you get fast loading pages plus all the modern functionality users expect.