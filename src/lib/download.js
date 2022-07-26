import ReactNativeBlobUtil from "react-native-blob-util"
import { getDownloadServer, Semaphore, getFileExt } from "./helpers"
import RNFS from "react-native-fs"
import { Platform, DeviceEventEmitter } from "react-native"
import { useStore } from "./state"
import { i18n } from "../i18n/i18n"
import storage from "./storage"
import { showToast } from "../components/Toasts"
import BackgroundTimer from "react-native-background-timer"
import { addItemToOfflineList } from "./services/offline"
import { getItemOfflinePath } from "./services/offline"
import DeviceInfo from "react-native-device-info"
import { clearCacheDirectories } from "./setup"
import pathModule from "react-native-path"

const cachedGetDownloadPath = {}
const downloadSemaphore = new Semaphore(3)
const maxThreads = 32
const downloadThreadsSemaphore = new Semaphore(maxThreads)

export const downloadFileChunk = ({ region, bucket, uuid, index, key, version }) => {
    return new Promise((resolve, reject) => {
        const maxTries = 1024
        let tries = 0
        const triesTimeout = 1000
        const requestTimeout = 3600000

        const download = async () => {
            if(tries >= maxTries){
                return reject(new Error("Max tries reached for download of UUID " + uuid))
            }

            tries += 1

            try{
                return resolve(await global.nodeThread.downloadAndDecryptChunk({
                    url: getDownloadServer() + "/" + region + "/" + bucket + "/" + uuid + "/" + index,
                    timeout: requestTimeout,
                    key,
                    version
                }))
            }
            catch(e){
                console.log(e)

                return BackgroundTimer.setTimeout(download, triesTimeout)
            }
        }

        download()
    })
}

export const getDownloadPath = ({ type = "temp" }) => {
    return new Promise((resolve, reject) => {
        const cacheKey = Platform.OS + ":" + type

        if(typeof cachedGetDownloadPath[cacheKey] !== "undefined"){
            return resolve(cachedGetDownloadPath[cacheKey])
        }

        if(Platform.OS == "android"){
            if(type == "temp"){
                return resolve(RNFS.CachesDirectoryPath + (RNFS.CachesDirectoryPath.slice(-1) == "/" ? "" : "/"))
            }
            else if(type == "thumbnail"){
                const root = RNFS.DocumentDirectoryPath + (RNFS.DocumentDirectoryPath.slice(-1) == "/" ? "" : "/")
                const path = root + "thumbnailCache"

                RNFS.mkdir(path).then(() => {
                    cachedGetDownloadPath[cacheKey] = path + "/"

                    return resolve(path + "/")
                }).catch(reject)
            }
            else if(type == "offline"){
                const root = RNFS.DocumentDirectoryPath + (RNFS.DocumentDirectoryPath.slice(-1) == "/" ? "" : "/")
                const path = root + "offlineFiles"

                RNFS.mkdir(path).then(() => {
                    cachedGetDownloadPath[cacheKey] = path + "/"

                    return resolve(path + "/")
                }).catch(reject)
            }
            else if(type == "misc"){
                const root = RNFS.DocumentDirectoryPath + (RNFS.DocumentDirectoryPath.slice(-1) == "/" ? "" : "/")
                const path = root + "misc"

                RNFS.mkdir(path).then(() => {
                    cachedGetDownloadPath[cacheKey] = path + "/"

                    return resolve(path + "/")
                }).catch(reject)
            }
            else if(type == "download"){
                return resolve(RNFS.DownloadDirectoryPath + (RNFS.DownloadDirectoryPath.slice(-1) == "/" ? "" : "/"))
            }
        }
        else{
            if(type == "temp"){
                return resolve(RNFS.CachesDirectoryPath + (RNFS.CachesDirectoryPath.slice(-1) == "/" ? "" : "/"))
            }
            else if(type == "thumbnail"){
                const root = RNFS.DocumentDirectoryPath + (RNFS.DocumentDirectoryPath.slice(-1) == "/" ? "" : "/")
                const path = root + "thumbnailCache"

                RNFS.mkdir(path).then(() => {
                    cachedGetDownloadPath[cacheKey] = path + "/"

                    return resolve(path + "/")
                }).catch(reject)
            }
            else if(type == "offline"){
                const root = RNFS.DocumentDirectoryPath + (RNFS.DocumentDirectoryPath.slice(-1) == "/" ? "" : "/")
                const path = root + "offlineFiles"

                RNFS.mkdir(path).then(() => {
                    cachedGetDownloadPath[cacheKey] = path + "/"

                    return resolve(path + "/")
                }).catch(reject)
            }
            else if(type == "misc"){
                const root = RNFS.DocumentDirectoryPath + (RNFS.DocumentDirectoryPath.slice(-1) == "/" ? "" : "/")
                const path = root + "misc"

                RNFS.mkdir(path).then(() => {
                    cachedGetDownloadPath[cacheKey] = path + "/"

                    return resolve(path + "/")
                }).catch(reject)
            }
            else if(type == "download"){
                const root = RNFS.DocumentDirectoryPath + (RNFS.DocumentDirectoryPath.slice(-1) == "/" ? "" : "/")
                const path = root + "Downloads"

                RNFS.mkdir(path).then(() => {
                    cachedGetDownloadPath[cacheKey] = path + "/"

                    return resolve(path + "/")
                }).catch(reject)
            }
        }
    })
}

export const getItemDownloadName = (path, item) => {
    return path + item.name + "_" + item.uuid + "." + getFileExt(item.name)
}

export const queueFileDownload = async ({ file, storeOffline = false, optionalCallback = undefined, saveToGalleryCallback = undefined, isOfflineUpdate = false, isPreview = false, showNotification = false }) => {
    let didStop = false

    const callOptionalCallback = (...args) => {
        if(typeof optionalCallback == "function"){
            optionalCallback(...args)
        }
    }

    const netInfo = useStore.getState().netInfo

    if(!netInfo.isInternetReachable || !netInfo.isInternetReachable){
        callOptionalCallback(new Error("device is offline"))

        return showToast({ message: i18n(storage.getString("lang"), "deviceOffline") })
    }

    if(typeof saveToGalleryCallback == "function"){
        try{
            const offlinePath = await getDownloadPath({ type: "offline" })
    
            if((await RNFS.exists(getItemOfflinePath(offlinePath, file)))){
                callOptionalCallback(null, getItemOfflinePath(offlinePath, file))

                return saveToGalleryCallback(getItemOfflinePath(offlinePath, file))
            }
        }
        catch(e){
            console.log(e)
        }
    }

    const addToState = () => {
        const currentDownloads = useStore.getState().downloads

        if(typeof currentDownloads[file.uuid] == "undefined"){
            currentDownloads[file.uuid] = {
                id: Math.random().toString().slice(3),
                file,
                chunksDone: 0,
                loaded: 0,
                stopped: false,
                paused: false
            }
        
            useStore.setState({
                downloads: currentDownloads
            })
        }

        return true
    }

    const removeFromState = () => {
        const currentDownloads = useStore.getState().downloads
        
        if(typeof currentDownloads[file.uuid] !== "undefined"){
            delete currentDownloads[file.uuid]

            useStore.setState({
                downloads: currentDownloads
            })
        }

        if(!isPreview){
            downloadSemaphore.release()
        }

        return true
    }

    const updateProgress = (chunksDone) => {
        const currentDownloads = useStore.getState().downloads

        if(typeof currentDownloads[file.uuid] !== "undefined"){
            currentDownloads[file.uuid].chunksDone = chunksDone

            useStore.setState({
                downloads: currentDownloads
            })
        }

        return true
    }

    const isStopped = () => {
        const currentDownloads = useStore.getState().downloads

        if(typeof currentDownloads[file.uuid] == "undefined"){
            return false
        }

        return currentDownloads[file.uuid].stopped
    }

    const currentDownloads = useStore.getState().downloads

    if(typeof currentDownloads[file.uuid] !== "undefined"){
        callOptionalCallback(new Error("already downloading this file"))

        return showToast({ message: i18n(storage.getString("lang"), "alreadyDownloadingFile", true, ["__NAME__"], [file.name]) })
    }

    addToState()

    const stopInterval = BackgroundTimer.setInterval(async () => {
        if(isStopped() && !didStop){
            didStop = true

            removeFromState()

            BackgroundTimer.clearInterval(stopInterval)
        }
    }, 100)

    if(!isPreview){
        await downloadSemaphore.acquire()
    }

    if(didStop){
        callOptionalCallback("stopped")

        return false
    }

    try{
        var downloadPath = await getDownloadPath({ type: (storeOffline ? "offline" : "download") })
    }
    catch(e){
        removeFromState()

        console.log(e)

        callOptionalCallback(new Error("could not get download path"))

        return showToast({ message: i18n(storage.getString("lang"), "couldNotGetDownloadPath") })
    }

    try{
        if(storage.getBoolean("onlyWifiDownloads:" + storage.getNumber("userId")) && netInfo.type !== "wifi"){
            return showToast({ message: i18n(storage.getString("lang"), "onlyWifiDownloads") })
        }
    }
    catch(e){
        console.log(e)
    }

    const filePath = pathModule.normalize(downloadPath + file.name)

    downloadWholeFileFSStream({
        file,
        progressCallback: (chunksDone) => {
            updateProgress(chunksDone)
        }
    }).then(async (path) => {
        BackgroundTimer.clearInterval(stopInterval)

        if(isPreview){
            removeFromState()

            return callOptionalCallback(null, path)
        }

        if(typeof saveToGalleryCallback == "function"){
            removeFromState()

            callOptionalCallback(null, path)
            
            return saveToGalleryCallback(path)
        }

        if(storeOffline){
            const offlinePath = getItemOfflinePath(downloadPath, file)

            try{
                if((await RNFS.exists(offlinePath))){
                    await RNFS.unlink(offlinePath)
                }
            }
            catch(e){
                console.log(e)
            }

            RNFS.moveFile(path, offlinePath).then(() => {
                addItemToOfflineList({
                    item: file
                }).then(() => {
                    removeFromState()

                    DeviceEventEmitter.emit("event", {
                        type: "mark-item-offline",
                        data: {
                            uuid: file.uuid,
                            value: true
                        }
                    })

                    if(isOfflineUpdate){
                        if(showNotification || useStore.getState().imagePreviewModalVisible){
                            showToast({ message: i18n(storage.getString("lang"), "fileStoredOfflineUpdate", true, ["__NAME__"], [file.name]) })
                        }
                    }
                    else{
                        if(showNotification || useStore.getState().imagePreviewModalVisible){
                            showToast({ message: i18n(storage.getString("lang"), "fileStoredOffline", true, ["__NAME__"], [file.name]) })
                        }
                    }

                    callOptionalCallback(null, offlinePath)

                    return console.log(file.name + " download done")
                }).catch((err) => {
                    removeFromState()
    
                    showToast({ message: err.toString() })

                    callOptionalCallback(err)
    
                    return console.log(err)
                })
            }).catch((err) => {
                removeFromState()

                showToast({ message: err.toString() })

                callOptionalCallback(err)

                return console.log(err)
            })
        }
        else{
            if(Platform.OS == "android"){
                if(Platform.constants.Version >= 29){
                    ReactNativeBlobUtil.MediaCollection.copyToMediaStore({
                        name: file.name,
                        parentFolder: "",
                        mimeType: file.mime
                    }, "Download", path).then(() => {
                        RNFS.unlink(path).then(() => {
                            removeFromState()

                            if(showNotification || useStore.getState().imagePreviewModalVisible){
                                showToast({ message: i18n(storage.getString("lang"), "fileDownloaded", true, ["__NAME__"], [file.name]) })
                            }

                            callOptionalCallback(null, "")
    
                            return console.log(file.name + " download done")
                        }).catch((err) => {
                            removeFromState()

                            showToast({ message: err.toString() })

                            callOptionalCallback(err)
    
                            return console.log(err)
                        })
                    }).catch((err) => {
                        removeFromState()

                        showToast({ message: err.toString() })

                        callOptionalCallback(err)
    
                        return console.log(err)
                    })
                }
                else{
                    try{
                        if((await RNFS.exists(filePath))){
                            await RNFS.unlink(filePath)
                        }
                    }
                    catch(e){
                        console.log(e)
                    }

                    RNFS.moveFile(path, filePath).then(() => {
                        removeFromState()

                        if(showNotification || useStore.getState().imagePreviewModalVisible){
                            showToast({ message: i18n(storage.getString("lang"), "fileDownloaded", true, ["__NAME__"], [file.name]) })
                        }

                        callOptionalCallback(null, filePath)
        
                        return console.log(file.name + " download done")
                    }).catch((err) => {
                        removeFromState()

                        showToast({ message: err.toString() })

                        callOptionalCallback(err)
        
                        return console.log(err)
                    })
                }
            }
            else{
                try{
                    if((await RNFS.exists(filePath))){
                        await RNFS.unlink(filePath)
                    }
                }
                catch(e){
                    console.log(e)
                }

                RNFS.moveFile(path, filePath).then(() => {
                    removeFromState()

                    if(showNotification || useStore.getState().imagePreviewModalVisible){
                        showToast({ message: i18n(storage.getString("lang"), "fileDownloaded", true, ["__NAME__"], [file.name]) })
                    }

                    callOptionalCallback(null, filePath)
    
                    return console.log(file.name + " download done")
                }).catch((err) => {
                    removeFromState()

                    showToast({ message: err.toString() })

                    callOptionalCallback(err)
    
                    return console.log(err)
                })
            }
        }
    }).catch((err) => {
        removeFromState()

        BackgroundTimer.clearInterval(stopInterval)

        if(err !== "stopped"){
            showToast({ message: err.toString() })

            console.log(err)
        }

        return callOptionalCallback(err)
    })
}

export const downloadWholeFileFSStream = ({ file, path = undefined, progressCallback = undefined, maxChunks = Infinity }) => {
    return new Promise(async (resolve, reject) => {
        try{
            const fileOfflinePath = getItemOfflinePath(await getDownloadPath({ type: "offline" }), file)

            if((await RNFS.exists(fileOfflinePath))){
                return resolve(fileOfflinePath)
            }
        }
        catch(e){
            //console.log(e)
        }

        try{
            if((await DeviceInfo.getFreeDiskStorage()) < (((1024 * 1024) * 256) + file.size)){ // We keep a 256 MB buffer in case previous downloads are still being written to the FS
                await clearCacheDirectories()

                await new Promise((resolve) => BackgroundTimer.setTimeout(resolve, 5000))

                if((await DeviceInfo.getFreeDiskStorage()) < (((1024 * 1024) * 256) + file.size)){ // We keep a 256 MB buffer in case previous downloads are still being written to the FS
                    return reject(i18n(storage.getString("lang"), "deviceOutOfStorage"))
                }
            }

            var tempDownloadPath = await getDownloadPath({ type: "temp" })
        }
        catch(e){
            return reject(e)
        }

        if(typeof path == "undefined"){
            path = tempDownloadPath + file.name + "_" + file.uuid + "." + getFileExt(file.name)
        }

        try{
            if((await RNFS.exists(path))){
                const existsStat = await RNFS.stat(path)

                if(existsStat.size >= (file.size - 131072)){
                    return resolve(path)
                }
                else{
                    await RNFS.unlink(path)
                }
            }
        }
        catch(e){
            //console.log(e)
        }

        try{
            var stream = await ReactNativeBlobUtil.fs.writeStream(path, "base64", false)
        }
        catch(e){
            return reject(e)
        }

        const isPaused = () => {
            const currentDownloads = useStore.getState().downloads
    
            if(typeof currentDownloads[file.uuid] == "undefined"){
                return false
            }
    
            return currentDownloads[file.uuid].paused
        }
    
        const isStopped = () => {
            const currentDownloads = useStore.getState().downloads
    
            if(typeof currentDownloads[file.uuid] == "undefined"){
                return false
            }
    
            return currentDownloads[file.uuid].stopped
        }

        let chunksDone = 0
        let currentIndex = -1
        let err = undefined
        let writeIndex = 0
        let didStop = false

        const stopInterval = BackgroundTimer.setInterval(async () => {
            if(isStopped() && !didStop){
                didStop = true

                try{
                    if((await RNFS.exists(path))){
                        await RNFS.unlink(path)
                    }
                }
                catch(e){
                    //console.log(e)
                }

                BackgroundTimer.clearInterval(stopInterval)
            }
        }, 10)

        const download = (index) => {
            return new Promise(async (resolve, reject) => {
                if(isPaused()){
                    await new Promise((resolve) => {
                        const wait = BackgroundTimer.setInterval(() => {
                            if(!isPaused() || isStopped()){
                                BackgroundTimer.clearInterval(wait)
    
                                return resolve()
                            }
                        }, 10)
                    })
                }
    
                if(didStop){
                    try{
                        if((await RNFS.exists(path))){
                            await RNFS.unlink(path)
                        }
                    }
                    catch(e){
                        //console.log(e)
                    }

                    return reject("stopped")
                }

                downloadFileChunk({
                    region: file.region,
                    bucket: file.bucket,
                    uuid: file.uuid,
                    index,
                    key: file.key,
                    version: file.version
                }).then((data) => {
                    let writeInterval = BackgroundTimer.setInterval(() => {
                        if(writeIndex == index){
                            BackgroundTimer.clearInterval(writeInterval)

                            stream.write(data).then(() => {
                                writeIndex = index + 1

                                if(typeof progressCallback == "function"){
                                    progressCallback(index + 1)
                                }
        
                                return resolve(index)
                            }).catch(reject)
                        }
                    }, 10)
                }).catch(reject)
            })
        }
  
        while(file.chunks > chunksDone && typeof err == "undefined"){
            let chunksLeft = (file.chunks - chunksDone)
            let chunksToDownload = maxThreads
            
            if(chunksLeft >= maxThreads){
                chunksToDownload = maxThreads
            }
            else{
                chunksToDownload = chunksLeft
            }
            
            const downloadChunks = []
            
            for(let i = 0; i < chunksToDownload; i++){
                currentIndex += 1

                downloadChunks.push(download(currentIndex))
            }
            
            try{
                await Promise.all(downloadChunks)
            }
            catch(e){
                err = e

                break
            }
            
            chunksDone += downloadChunks.length
        }

        stream.close()

        BackgroundTimer.clearInterval(stopInterval)

        if(typeof err !== "undefined"){
            try{
                if((await RNFS.exists(path))){
                    await RNFS.unlink(path)
                }
            }
            catch(e){
                //console.log(e)
            }

            return reject(err)
        }

        return resolve(path)
    })
}