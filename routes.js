import browserify from 'browserify'
import koaWatchify from 'koa-watchify'
import watchify from 'watchify'
import koaStatic from 'koa-static'
import KoaRouter from 'koa-router'
import path from 'path'
import fs from 'fs'
import isDev from './server/env/is-dev'
import httpErrors from './server/http/errors'

const router = KoaRouter()
const jsFileMatcher = RegExp.prototype.test.bind(/\.js$/)

function* send404(next) {
  throw new httpErrors.NotFoundError()
}

function applyRoutes(app) {
  app.use(router.routes())
    .use(router.allowedMethods())

  // client script (browserified)
  let bundle = browserify({
    entries: [ require.resolve('./client/index.jsx') ],
    fullPaths: false,
    debug: isDev,
    packageCache: {},
    cache: {}
  })

  if (isDev) {
    bundle.transform('livereactload', { global: true })
    bundle = watchify(bundle)
    // start up a livereactload server to enable live reloading
    const livereload = require('livereactload')
    livereload.listen()
    bundle.on('update', () => livereload.notify())
  } else {
    bundle.transform('uglifyify', { global: true })
  }
  router.get('/scripts/client.js', koaWatchify(bundle))


  // api methods (through HTTP)
  const apiFiles = fs.readdirSync(path.join(__dirname, 'server', 'api'))
  const baseApiPath = '/api/1/'
  apiFiles.filter(jsFileMatcher).forEach(filename => {
    const apiPath = baseApiPath + path.basename(filename, '.js')
    const subRouter = new KoaRouter()
    require('./server/api/' + filename)(subRouter)
    router.use(apiPath, subRouter.routes())
    console.log('mounted ' + apiPath)
  })
  // error out on any API URIs that haven't been explicitly handled, so that we don't end up
  // sending back HTML due to the wildcard rule below
  router.all('/api/:param*', send404)

  // common requests that we don't want to return the regular page for
  // TODO(tec27): we should probably do something based on expected content type as well
  router.get('/robots.txt', send404)
    .get('/favicon.ico', send404)

  // catch-all for the remainder, first tries static files, then if not found, renders the index and
  // expects the client to handle routing
  router.get('/:param*', koaStatic(path.join(__dirname, 'public')), function*(next) {
    let sessionData
    if (this.session.userId) {
      sessionData = {}
      sessionData.user = { id: this.session.userId, name: this.session.userName }
      sessionData.permissions = this.session.permissions
    }
    yield this.render('index', { curSession: sessionData })
  })
}

export default applyRoutes
