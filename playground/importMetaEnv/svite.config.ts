import { defineConfig } from 'svite'

export default defineConfig({
    mode:'./',
    base:'spp',
    define:{
        'import.meta.env.age':30
    }
})