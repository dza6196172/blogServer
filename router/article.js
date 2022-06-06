const express = require('express')
const router = express.Router()
const db = require('../db/index')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const fs = require('fs')
const moment = require('moment')
const path = require('path');

const upload = multer({ dest: path.join(__dirname, '../upload') });
const coverUpload = multer({ dest: path.join(__dirname, '../upload/cover') });

// const storage = multer.diskStorage({
//   // destination:'public/uploads/'+new Date().getFullYear() + (new Date().getMonth()+1) + new Date().getDate(),
//   destination: function (req, file, callback) {
//     callback(null, '../upload/');
//   },
//   filename: function (req, file, callback) {
//     // var fileFormat = (file.originalname).split(".");
//     callback(null, file.originalname);
//   }
// });

// const upload = multer({ storage: storage });

router.post('/uploadImage', upload.single('file'), (req, res) => {
  let fileObj = req.file;
  let type = fileObj.mimetype.split('/')[1]
  fs.rename(path.join(__dirname, `../upload/${fileObj.filename}`), path.join(__dirname, `../upload/${fileObj.filename}.${type}`), (err) => {
    if (err) {
      res.error(err)
    } else {
      res.send({
        code: 200, msg: '上传成功', data: {
          pic: req.protocol + '://' + req.hostname + ':9001/' + fileObj.filename + `.${type}`
        }
      })
    }
  })

})

router.post('/uploadCover', coverUpload.single('file'), (req, res) => {
  let fileObj = req.file;
  let type = fileObj.mimetype.split('/')[1]
  fs.rename(path.join(__dirname, `../upload/cover/${fileObj.filename}`), path.join(__dirname, `../upload/cover/${fileObj.filename}.${type}`), (err) => {
    if (err) {
      return res.error(err)
    }
    res.send({
      code: 200, msg: '上传成功', data: {
        pic: req.protocol + '://' + req.hostname + ':9001/' + fileObj.filename + `.${type}`
      }
    })
  })
})

router.post('/uploadArticle', (req, res) => {
  if (!req.headers.authorization) {
    return res.error('暂不对外开放文章上传功能！')
  }
  const data = req.body
  const token = req.headers.authorization.split(' ')[1]
  let p = new Promise((resolve, reject) => {
    jwt.verify(token, 'dzablog', (err, decode) => {
      if (err) {
        res.error(err)
        reject()
      }
      if (decode.email !== '799552934@qq.com') {
        res.error('暂不对外开放文章上传功能！')
        reject()
      }
      resolve()
    })
  })
  p.then(() => {
    if (!data.title || data.content.length < 100) {
      return res.error(!data.title ? '请填写标题！' : '博客长度过短！')
    }
    if (data.tags.length === 0 && data.tags.length > 5) {
      return res.error(data.tags.length === 0 ? '请添加标签' : '标签数量限制为5')
    }

    let tagArticleFn = function (id, list) {
      list.forEach((item, index) => {
        list[index] = '(' + id + ',"' + item + '")'
      })
      return list.join(',')
    }
    data.create_date = new Date()
    db.query('INSERT INTO article set ?', {
      title: data.title,
      content: data.content,
      pic: data.pic,
      desc: data.desc,
      category: data.category,
      create_date: data.create_date
    }, (err, results) => {
      if (err) {
        res.error(err)
      } else {
        db.query(`INSERT INTO tag_article(article_id,tag_name) VALUE ${tagArticleFn(results.insertId, data.tags)}`, (err, results) => {
          if (err) {
            res.error(err)
          } else {
            res.send({ code: 200, msg: '发布博客成功！', data: { article_id: results.insertId } })
          }
        })
      }
    })
  }).catch(() => {

  })
})

router.post('/updateArticle', (req, res) => {
  const data = req.body
  if (!data.title || data.content.length < 100) {
    return res.error(!data.title ? '请填写标题！' : '博客长度过短！')
  }
  if (data.tags.length === 0 && data.tags.length > 5) {
    return res.error(data.tags.length === 0 ? '请添加标签' : '标签数量限制为5')
  }

  let tagArticleFn = function (id, list) {
    list.forEach((item, index) => {
      list[index] = '(' + id + ',"' + item + '")'
    })
    return list.join(',')
  }
  db.query('UPDATE article SET ? WHERE article_id = ?', [{
    title: data.title,
    content: data.content,
    pic: data.pic,
    desc: data.desc,
    category: data.category
  }, data.article_id], (err, results) => {
    if (err) {
      res.error(err)
    } else {
      db.query(`INSERT IGNORE INTO tag_article(article_id,tag_name) VALUE ${tagArticleFn(data.article_id, data.tags)}`, (err, results) => {
        if (err) {
          res.error(err)
        } else {
          res.send({ code: 200, msg: '更新博客成功！' })
        }
      })
    }
  })

})

router.get('/getArticleList', (req, res) => {
  const data = req.query
  let pageSize = data.pageSize ? parseInt(data.pageSize) : 10
  let pageNum = data.pageNum ? parseInt(data.pageNum) : 1
  let category_id = data.category_id
  let date = data.date
  let tagList = data.tagList
  function tagIds(tagList) {
    let str = ''
    tagList.forEach((item, index) => {
      if (index) {
        str += ' OR t.tag_id = ' + item
      } else {
        str += 't.tag_id = ' + item
      }
    })
    return `a.article_id = ANY (
      SELECT ta.article_id FROM tag_article ta
      LEFT JOIN tags t ON t.tag_name = ta.tag_name
      WHERE ${str}
      GROUP BY ta.article_id
    ) `
  }

  function query(category_id, date) {
    let sql = ''
    if (category_id) {
      sql = `LEFT JOIN category c ON c.category_name = a.category `
    }
    sql += `${category_id ? 'WHERE c.category_id = ' + category_id + ' ' : ''}`

    if (category_id && tagList) {
      sql += `AND ${tagIds(tagList)}  `
    } else if (!category_id && tagList) {
      sql += `WHERE ${tagIds(tagList)} `
    }

    if ((tagList || category_id) && date) {
      sql += `AND YEAR(a.create_date) =${date}`
    } else if (!(tagList || category_id) && date) {
      sql = `WHERE YEAR(a.create_date) =${date}`
    }

    return sql
  }
  let newdata = {}
  let p1 = new Promise((resolve, reject) => {
    db.query(`SELECT COUNT(article_id) total
            FROM article a 
            LEFT JOIN tag_article ta USING (article_id)
            ${query(category_id, date)}
            GROUP BY a.article_id 
            ORDER BY create_date DESC`, (err, results) => {
      if (err) {
        res.error(err)
        reject
      }
      newdata.total = results.length
      resolve()
    })
  })
  let p2 = new Promise((resolve, reject) => {
    db.query(`SELECT a.article_id,a.create_date,a.title,a.watch,a.thumbsup,a.pic,a.category,a.desc,GROUP_CONCAT(ta.tag_name) tags 
            FROM article a 
            LEFT JOIN tag_article ta USING (article_id)
            ${query(category_id, date)}
            GROUP BY a.article_id 
            ORDER BY create_date DESC 
            LIMIT ${(pageNum - 1) * pageSize},${pageSize}`, (err, results) => {
      if (err) {
        res.error(err)
        reject()
      }
      newdata.articleList = results
      resolve()
    })
  })
  Promise.all([p1,p2]).then(results => {
    res.send({ code: 200, msg: '获取成功', data: newdata })
  })

})

router.get('/searchArticle', (req, res) => {
  const { keyword } = req.query
  if (!keyword) {
    return res.error('请输入关键词！')
  }
  db.query(`SELECT a.*,GROUP_CONCAT(ta.tag_name) tags FROM article a
  LEFT JOIN tag_article ta USING (article_id)
  WHERE a.article_id = ANY (
      SELECT ta.article_id FROM tag_article ta
      LEFT JOIN tags t ON t.tag_name = ta.tag_name
      WHERE t.tag_name LIKE '%${keyword}%'
      GROUP BY ta.article_id
    ) OR a.title LIKE '%${keyword}%' OR a.category LIKE '%${keyword}%'
    GROUP BY a.article_id
    ORDER BY a.create_date DESC`, (err, results) => {
    if (err) {
      return res.error(err)
    }
    res.send({ code: 200, msg: '获取成功', data: results })
  })
})

router.get('/getArticle', (req, res) => {
  const data = req.query
  let article_id = data.id
  db.query(`SELECT a.*,GROUP_CONCAT(t.tag_name) tags,
  (SELECT article_id	FROM article WHERE article_id < ? ORDER BY article_id DESC LIMIT 1) last,
  (SELECT article_id	FROM article WHERE article_id > ? LIMIT 1) next,
  (SELECT title FROM article WHERE article_id < ? ORDER BY article_id DESC LIMIT 1) lastTitle,
  (SELECT title FROM article WHERE article_id > ? LIMIT 1) nextTitle
  FROM article a 
  LEFT JOIN tag_article t USING (article_id) 
  WHERE a.article_id=?
  GROUP BY a.article_id`, [article_id,article_id,article_id,article_id,article_id], (err, results) => {
    if (err) {
      return res.error(err)
    }
    const articleContent = results[0]
    db.query(`UPDATE article SET watch=${articleContent.watch + 1} WHERE article_id = ${article_id}`, (err, results) => {
      if (err) {
        return res.error(err)
      }
      res.send({ code: 200, msg: '获取成功', data: articleContent })
    })
  })
})

router.post('/sendComment', (req, res) => {
  let data = req.body
  data.date = moment().format('YYYY-MM-DD HH:mm:ss')
  if (req.headers.authorization) {
    const token = req.headers.authorization.split(' ')[1]

    jwt.verify(token, 'dzablog', (err, decode) => {
      if (err) {
        return res.error(err)
      }
      db.query(`INSERT INTO comment (content,email,date,article_id) VALUES ('${data.comment}','${decode.email}','${data.date}',${data.article_id})`, (err, results) => {
        if (err) {
          return res.error(err)
        }
        return res.send({ code: 200, msg: '评论成功' })
      })
    })
  } else {
    db.query(`INSERT INTO comment (content,date,article_id) VALUES ('${data.comment}','${data.date}',${data.article_id})`, (err, results) => {
      if (err) {
        return res.error(err)
      }
      return res.send({ code: 200, msg: '评论成功' })
    })
  }
})

router.get('/getComment', (req, res) => {
  let data = req.query
  db.query(`SELECT c.*,u.nickname,u.avatar FROM comment c LEFT JOIN users u USING (email) 
  WHERE article_id = ? ORDER BY date DESC`, data.id, (err, results) => {
    if (err) {
      return res.error(err)
    }
    return res.send({ code: 200, msg: '获取评论成功', data: results })
  })
})

router.get('/getTags', (req, res) => {
  db.query(`SELECT * FROM tags`, (err, results) => {
    if (err) {
      return res.error(err)
    }
    return res.send({ code: 200, msg: '获取标签成功', data: results })
  })
})

router.post('/addTags', (req, res) => {
  let tagList = req.body
  if (tagList.length > 5) {
    return res.error('限制5个标签')
  } else if (tagList.length === 0) {
    return res.error('请添加标签！')
  }
  let tagFn = function (list) {
    list.forEach((item, index) => {
      list[index] = '("' + item + '")'
    })
    return list.join(',')
  }
  db.query(`INSERT IGNORE INTO tags(tag_name) VALUES ${tagFn(tagList)}`, (err, results) => {
    if (err) {
      return res.error(err)
    }
    return res.send({ code: 200, msg: '添加标签成功' })
  })
})

router.get('/getCategory', (req, res) => {
  db.query(`SELECT c.*,COUNT(a.article_id) count FROM category c
  LEFT JOIN article a ON a.category = c.category_name
  GROUP BY  c.category_id`, (err, results) => {
    if (err) {
      return res.error(err)
    }
    return res.send({ code: 200, msg: '获取分类成功', data: results })
  })
})

router.post('/addCategory', (req, res) => {
  let categoryList = req.body
  if (categoryList.length > 1) {
    return res.error('限制1个分类')
  } else if (categoryList.length === 0) {
    return res.error('请添加分类！')
  }
  let tagFn = function (list) {
    list.forEach((item, index) => {
      list[index] = '("' + item + '")'
    })
    return list.join(',')
  }
  db.query(`INSERT IGNORE INTO category(category_name) VALUES ${tagFn(categoryList)}`, (err, results) => {
    if (err) {
      return res.error(err)
    }
    return res.send({ code: 200, msg: '添加分类成功' })
  })
})

router.get('/getYear', (req, res) => {
  db.query(`SELECT YEAR(create_date) year,COUNT(*) count FROM article
  GROUP BY YEAR(create_date)
  ORDER BY year DESC`, (err, results) => {
    if (err) {
      return res.error(err)
    }
    return res.send({ code: 200, msg: '获取年份成功', data: results })
  })
})

module.exports = router