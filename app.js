const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const path = require('path');
const multer = require('multer')

//解决跨域问题
const cors = require('cors')
app.use(cors({ origin: ['http://localhost:8080', 'http://124.220.193.90', 'http://www.dzablog.com','http://192.168.31.176:8080'] }))

//解析application/x-www-form-urlencoded的数据
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

//处理错误中间件
app.use((req, res, next) => {
  res.error = (err, code = 500) => {
    res.send({
      code,
      msg: err instanceof Error ? err.message : err
    })
  }
  next()
})

app.use(express.static(path.join(__dirname, 'upload')));
app.use(express.static(path.join(__dirname, 'upload/cover')));
app.use(express.static(path.join(__dirname, 'upload/avatar')));

//接受formdata中间件
// const formidable = require('express-formidable')
// app.use(formidable())

//解析token中间件
const { expressjwt: jwt } = require('express-jwt')
// app.use(jwt({ secret: 'dzablog', algorithms: ['HS256'] }).unless({
//   path: [
//     '/api/login',
//     '/api/register',
//     '/api/getCode',
//     '/api/uploadImage',
//     '/api/getArticleList',
//     '/api/getArticle',
//     '/api/getComment',
//     '/api/sendComment'
//   ]
// }))


//路由
const userRouter = require('./router/user')
const articleRouter = require('./router/article')
const statisticRouter = require('./router/statistic')

app.use('/api', userRouter)
app.use('/api', articleRouter)
app.use('/api', statisticRouter)

app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.error('身份认证已过期，请重新登录', 304)
  }
})

app.listen(9001, () => {
  console.log('server running');
})