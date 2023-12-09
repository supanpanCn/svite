function adjustTemplate(oldName,newName){
    const fs = require('fs')
    const path = require('path')
    const prefix = process.cwd() 
    const oldPath = path.resolve(prefix,oldName)
    const newPath = path.resolve(prefix,newName)
    if(fs.existsSync(oldPath)){
        fs.renameSync(oldPath,newPath)
    }
}

function check(projectName){
    const fs = require('fs')
    const path = require('path')
    const prefix = process.cwd() 
    const targetPath = path.resolve(prefix,projectName)
    if(fs.existsSync(targetPath)){
        console.error('仓库已存在，重新命名为：projectName_1')
        adjustTemplate(projectName,'projectName_1')
    }
}

(function(){
    const args = process.argv.slice(2)
    if(args.length && args.length === 2 && args[0] === '--projectName'){
        const projectName = require('path').join(process.cwd(), args[1]);
        check(projectName)
        const exec = require('child_process').exec
        exec("git clone https://github.com/supanpanCn/vue-blob.git",{ clone: true },(err)=>{
            if(err){
                console.error('模板下载失败，请稍后重试',err)
            }else{
                adjustTemplate('vue-blob',projectName)
                console.log('模板下载成功')
            }
        })
        return
    }

    console.error('projectName缺失，请使用--projectName yourname')
}())