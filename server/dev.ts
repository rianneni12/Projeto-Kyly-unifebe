import { app } from '../api/index'

const port = Number(process.env.PORT ?? 3001)

app.listen(port, () => {
  process.stdout.write(`API on http://127.0.0.1:${port}\n`)
})

