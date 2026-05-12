import cluster from "node:cluster"
import os from "node:os"
import process from "node:process"

if (cluster.isPrimary) {
  const workers = os.availableParallelism()
  let ready = 0
  console.log(`Starting ${workers} workers on port ${process.env.PORT ?? 3001}...`)
  for (let i = 0; i < workers; i++) cluster.fork()
  cluster.on("message", (_, msg) => {
    if (msg === "ready") {
      ready++
      process.stdout.write(`\r🦊 Workers ready: ${ready}/${workers}`)
      if (ready === workers) console.log("")
    }
  })
} else {
  await import("./server")
  process.send?.("ready")
}
