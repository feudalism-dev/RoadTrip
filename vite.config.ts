import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub project pages: https://<user>.github.io/RoadTrip/
export default defineConfig({
  plugins: [react()],
  base: '/RoadTrip/',
})
