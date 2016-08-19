import koaConvert from 'koa-convert'
import koaStatic from 'koa-static'
import KoaRouter from 'koa-router'
import httpErrors from 'http-errors'
import path from 'path'
import fs from 'fs'
import isDev from './server/env/is-dev'
import config from './config'

const router = KoaRouter()
const jsFileMatcher = RegExp.prototype.test.bind(/\.js$/)

function send404(ctx, next) {
  throw new httpErrors.NotFound()
}

function applyRoutes(app) {
  app.use(router.routes())
    .use(router.allowedMethods())

  // api methods (through HTTP)
  const apiFiles = fs.readdirSync(path.join(__dirname, 'server', 'api'))
  const baseApiPath = '/api/1/'
  apiFiles.filter(jsFileMatcher).forEach(filename => {
    const apiPath = baseApiPath + path.basename(filename, '.js')
    const subRouter = new KoaRouter()
    require('./server/api/' + filename).default(subRouter)
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

  if (isDev) {
    // We expect the styles to be included in the development JS (so they can be hot reloaded)
    router.get('/styles/site.css', function(ctx, next) {
      ctx.body = ''
      ctx.type = 'text/css'
    })
  }

  // catch-all for the remainder, first tries static files, then if not found, renders the index and
  // expects the client to handle routing
  router.get(
    '/:param*', koaConvert(koaStatic(path.join(__dirname, 'public'))), async function(ctx, next) {
      const initData = {}
      if (ctx.session.userId) {
        initData.auth = {
          user: { id: ctx.session.userId, name: ctx.session.userName },
          permissions: ctx.session.permissions,
        }
      }
      await ctx.render('index',
          { initData, analyticsId: config.analyticsId, feedbackUrl: config.feedbackUrl })
    }
  )
}

export default applyRoutes
