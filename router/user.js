const express = require('express')
const router = express.Router()
const db = require('../db/index')
const bcrypt = require('bcryptjs')
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer')
const moment = require('moment')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const path = require('path');
const fs = require('fs')

const avatarUpload = multer({ dest: path.join(__dirname, '../upload/avatar') });

//邮箱验证码相关配置
let transporter = nodemailer.createTransport({
  host: 'smtp.qq.com',
  secureConnection: true,
  port: 465,
  auth: {
    user: '799552934@qq.com',
    pass: 'fgkbxdfoxgpibchc'
  }
})

let options = {
  from: '799552934@qq.com',
  to: '',
  subject: '邮箱注册测试',
  html: ''
}

//注册
router.post('/register',
  body('email').isEmail().withMessage('请输入正确的邮箱格式!'),
  body('password').isLength({ min: 1 }).withMessage('请输入密码!').isLength({ min: 6 }).withMessage('密码长度需大于6'),
  body('code').isLength({ min: 1 }).withMessage('请输入验证码!'),
  (req, res) => {
    console.log(req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.error(errors.errors[0].msg)
    }
    const userinfo = req.body

    db.query('select * from users where email=?', [userinfo.email], (err, results) => {
      if (err) {
        return res.error(err)
      }
      if (results.length > 0) {
        return res.error('该邮箱已被注册')
      } else {
        //密码加密
        db.query('select * from email_code where email=?', [userinfo.email], (err, results) => {
          if (results.length > 0) {
            if (results[0].code != userinfo.code) {
              return res.error('验证码不正确!')
            } else if (moment(results[0].expire_time).isBefore(moment().format('YYYY-MM-DD HH:mm:ss'))) {
              return res.error('验证码已过期!')
            } else {
              userinfo.password = bcrypt.hashSync(userinfo.password, 10)
              db.query('insert into users set ?', [{ email: userinfo.email, password: userinfo.password }], (err, results) => {
                if (err) {
                  return res.error(err)
                }
                if (results.affectedRows !== 1) {
                  return res.error('注册失败，请稍后再试')
                }
                db.query('delete from email_code where email=?', [userinfo.email], (err, results) => {
                  if (err) {
                    return res.error(err)
                  }
                  if (results.affectedRows !== 1) {
                    return res.error('注册失败，请稍后再试')
                  }
                  res.send({ code: 200, msg: '注册成功' })
                })
              })
            }
          }
        })
      }
    })
  })

//获取验证码
router.post('/getCode',
  body('email').isEmail().withMessage('请输入正确的邮箱格式!'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.error(errors.errors[0].msg)
    }
    let email = req.body.email
    db.query('select * from users where email=?', [email], (err, results) => {
      if (err) {
        return res.error(err)
      }
      if (results.length > 0) {
        return res.error('该邮箱已被注册')
      }
      db.query('select * from email_code where email=?', [email], (err, results) => {
        if (err) {
          return res.error(err)
        }
        options.to = email
        if (results.length > 0) {
          if (moment(results[0].expire_time).isAfter(moment().format('YYYY-MM-DD HH:mm:ss'))) {
            options.html = `欢迎注册小杜的博客，您的验证码为：${results[0].code}`
            transporter.sendMail(options, (err, msg) => {
              if (err) {
                return res.error(err)
              } else {
                return res.send({ code: 200, msg: '验证码已发送' })
              }
            })
            return
          }
        }


        let code = "";
        for (var i = 0; i < 6; i++) {
          var radom = Math.floor(Math.random() * 10);
          code += radom;
        }
        options.html = `欢迎注册小杜的博客，您的验证码为：${code}`
        transporter.sendMail(options, (err, msg) => {
          if (err) {
            return res.error(err)
          } else {
            return res.send({ code: 200, msg: '验证码已发送' })
          }
        })
        if (results.length > 0) {
          db.query('update email_code set ? where email=?', [{ email, code, expire_time: moment().add(30, 'm').format('YYYY-MM-DD HH:mm:ss') }, email], (err, results) => {
            if (err) {
              return res.error(err)
            }
            return res.send({ code: 200, msg: '验证码已发送' })
          })
        } else {
          db.query('insert into email_code set ?', [{ email, code, expire_time: moment().add(30, 'm').format('YYYY-MM-DD HH:mm:ss') }], (err, results) => {
            if (err) {
              return res.error(err)
            }
            return res.send({ code: 200, msg: '验证码已发送' })
          })
        }
      })

    })
  })

//登录
router.post('/login',
  body('email').isEmail().withMessage('请输入正确的邮箱格式!'),
  // password must be at least 5 chars long
  body('password').isLength({ min: 1 }).withMessage('请输入密码!').isLength({ min: 6 }).withMessage('密码长度需大于6'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.error(errors.errors[0].msg)
    }
    let userinfo = req.body
    db.query('select * from users where email=?', [userinfo.email], (err, results) => {
      if (err) {
        return res.error(err)
      }
      if (results.length === 0) {
        return res.error('用户不存在!')
      }
      if (!bcrypt.compareSync(userinfo.password, results[0].password)) {
        return res.error('密码错误!')
      }
      let tokenInfo = {
        email: results[0].email,
      }
      const tokenStr = jwt.sign(tokenInfo, 'dzablog', { expiresIn: '7d' })
      res.send({
        code: 200,
        msg: '登录成功!',
        token: 'Bearer ' + tokenStr
      })
    })
  })

//获取用户信息
router.get('/getUserInfo', (req, res) => {
  if (!req.headers.authorization) {
    return res.send({ code: 301, msg: '请先登录' })
  }
  const token = req.headers.authorization.split(' ')[1]
  jwt.verify(token, 'dzablog', (err, decode) => {
    if (err) {
      return res.error('身份认证已过期，请重新登录', 304)
    }
    db.query('SELECT email,nickname,avatar,age,gender FROM users WHERE email = ?', decode.email, (err, results) => {
      if (err) {
        return res.error(err)
      }
      res.send({ code: 200, msg: '获取成功', data: results[0] })
    })
  })
})

//修改头像
router.post('/updateAvatar', avatarUpload.single('file'), (req, res) => {
  let fileObj = req.file;
  let type = fileObj.mimetype.split('/')[1]
  const token = req.headers.authorization.split(' ')[1]
  fs.rename(path.join(__dirname, `../upload/avatar/${fileObj.filename}`), path.join(__dirname, `../upload/avatar/${fileObj.filename}.${type}`), (err) => {
    if (err) {
      return res.error(err)
    }
    const pic = req.protocol + '://' + req.hostname + ':9001/' + fileObj.filename + `.${type}`
    jwt.verify(token, 'dzablog', (err, decode) => {
      if (err) {
        return res.error(err)
      }
      db.query('UPDATE users SET avatar = ? WHERE email = ?', [pic, decode.email], (err, results) => {
        if (err) {
          return res.error(err)
        }
        res.send({ code: 200, msg: '修改成功' })
      })
    })
  })
})

//修改用户信息

router.post('/updateInfo', body('nickname').isLength({ min: 1 }).withMessage('请输入昵称!').isLength({ max: 8 }).withMessage('昵称不得大于8个字符'),
  body('age').isLength({ min: 1 }).withMessage('请输入年龄!'), (req, res) => {
    let data = req.body;
    const token = req.headers.authorization.split(' ')[1]
    jwt.verify(token, 'dzablog', (err, decode) => {
      if (err) {
        return res.error(err)
      }
      db.query('UPDATE users SET nickname = ?,age=?,gender=? WHERE email = ?', [data.nickname, data.age, data.gender, decode.email], (err, results) => {
        if (err) {
          return res.error(err)
        }
        res.send({ code: 200, msg: '修改成功' })
      })
    })
  })

//留言
router.post('/postMessage', body('nickname').isLength({ min: 1 }).withMessage('请输入昵称!'),
  body('content').isLength({ min: 1 }).withMessage('请输入留言!').isLength({ max: 300 }).withMessage('留言字符限制300'), (req, res) => {
    let data = req.body;
    data.date = moment().format('YYYY-MM-DD HH:mm:ss')
    if(req.headers.authorization){
      const token = req.headers.authorization.split(' ')[1]
      jwt.verify(token, 'dzablog', (err, decode) => {
        if (err) {
          return res.error(err)
        }
        db.query(`INSERT INTO message (nickname,content,email,date) VALUES ('${data.name}','${data.content}','${decode.email}','${data.date}')`, (err, results) => {
          if (err) {
            return res.error(err)
          }
          res.send({ code: 200, msg: '留言成功' })
        })
      })
    }else{
      db.query(`INSERT INTO message (nickname,content,date) VALUES ('${data.name}','${data.content}','${data.date}')`,(err,results) => {
        if (err) {
          return res.error(err)
        }
        res.send({ code: 200, msg: '留言成功' })
      })
    }
    
  })

//获取留言
router.get('/getMessage',((req,res) => {
  let page = req.query
  let data = {}
  let p1 = new Promise((resolve,reject) => {
    db.query(`SELECT m.*,u.avatar FROM message m LEFT JOIN users u USING (email) ORDER BY date DESC
    LIMIT ${(page.pageNum - 1) * page.pageSize},${page.pageSize}`,(err,results) => {
      if (err) {
        res.error(err);
        reject()
      }
      data.messageList = results
      resolve()
    })
  })
  let p2 = new Promise((resolve,reject) => {
    db.query(`SELECT COUNT(message_id) total FROM message ORDER BY date DESC
    LIMIT ${(page.pageNum - 1) * page.pageSize},${page.pageSize}`,(err,results) => {
      if (err) {
        res.error(err)
        reject()
      }
      data.total = results[0].total
      resolve()
    })
  })
  Promise.all([p1,p2]).then(result => {
    res.send({ code: 200, msg: '获取成功',data:data })
  })
}))

module.exports = router