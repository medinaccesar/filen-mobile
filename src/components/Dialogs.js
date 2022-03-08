import React, { useState, useEffect, useRef } from "react"
import Dialog from "react-native-dialog"
import { useStore } from "../lib/state"
import { storage } from "../lib/storage"
import { useMMKVBoolean, useMMKVString } from "react-native-mmkv"
import { getParent, fileAndFolderNameValidation } from "../lib/helpers"
import { createFolder, folderExists, fileExists, renameFile, renameFolder, deleteItemPermanently, removeSharedInItem, stopSharingItem } from "../lib/api"
import { showToast } from "./Toasts"
import { i18n } from "../i18n/i18n"
import { DeviceEventEmitter } from "react-native"

export const RenameDialog = () => {
    const [darkMode, setDarkMode] = useMMKVBoolean("darkMode", storage)
    const [value, setValue] = useState("")
    const inputRef = useRef()
    const [buttonsDisabled, setButtonsDisabled] = useState(false)
    const renameDialogVisible = useStore(state => state.renameDialogVisible)
    const setRenameDialogVisible = useStore(state => state.setRenameDialogVisible)
    const currentActionSheetItem = useStore(state => state.currentActionSheetItem)
    const [lang, setLang] = useMMKVString("lang", storage)
    const [ext, setExt] = useState("")

    useEffect(() => {
        setButtonsDisabled(false)

        if(typeof currentActionSheetItem !== "undefined"){
            if(currentActionSheetItem.type == "folder"){
                setValue(currentActionSheetItem.name.trim())
            }
            else{
                if(currentActionSheetItem.name.indexOf(".") !== -1){
                    const nameEx = currentActionSheetItem.name.split(".")
			        const fileExt = nameEx[nameEx.length - 1]

                    nameEx.pop()

                    setValue(nameEx.join(".").trim())
                    setExt(fileExt.trim())
                }
                else{
                    setValue(currentActionSheetItem.name.trim())
                }
            }
        }

        if(renameDialogVisible){
            setTimeout(() => {
                inputRef.current.focus()
                inputRef.current.setNativeProps({ selection: { start: value.length, end: value.length } })
            }, 250)
        }
    }, [renameDialogVisible])

    return (
        <Dialog.Container
            visible={renameDialogVisible}
            useNativeDriver={false}
            onRequestClose={() => setRenameDialogVisible(false)}
            onBackdropPress={() => {
                if(!buttonsDisabled){
                    setRenameDialogVisible(false)
                }
            }}
        >
            <Dialog.Title>{i18n(lang, "rename")}</Dialog.Title>
            <Dialog.Input placeholder={i18n(lang, "newName")} value={value} selection={{ start: value.length, end: value.length }} onChangeText={(val) => setValue(val)} textInputRef={inputRef} />
            <Dialog.Button label={i18n(lang, "cancel")} disabled={buttonsDisabled} onPress={() => setRenameDialogVisible(false)} />
            <Dialog.Button label={i18n(lang, "rename")} disabled={buttonsDisabled} onPress={() => {
                setButtonsDisabled(true)
                setRenameDialogVisible(false)

                useStore.setState({ fullscreenLoadingModalVisible: true })

                let name = value.trim()
                const item = currentActionSheetItem

                if(item.name == name){
                    setButtonsDisabled(false)

                    useStore.setState({ fullscreenLoadingModalVisible: false })

                    return showToast({ message: i18n(lang, "invalidFolderName") })
                }

                if(item.type == "file"){
                    name = name + "." + ext
                }

                if(item.type == "folder"){
                    if(!fileAndFolderNameValidation(name)){
                        setButtonsDisabled(false)

                        useStore.setState({ fullscreenLoadingModalVisible: false })
    
                        return showToast({ message: i18n(lang, "invalidFolderName") })
                    }

                    folderExists({ name, parent: item.parent }).then((res) => {
                        if(res.exists){
                            if(item.uuid !== res.existsUUID){
                                setButtonsDisabled(false)

                                useStore.setState({ fullscreenLoadingModalVisible: false })
    
                                return showToast({ message: i18n(lang, "alreadyExistsInThisFolder", true, ["__NAME__"], [name]) })
                            }
                        }

                        renameFolder({ folder: item, name }).then(async () => {
                            DeviceEventEmitter.emit("event", {
                                type: "change-item-name",
                                data: {
                                    uuid: item.uuid,
                                    name
                                }
                            })

                            setButtonsDisabled(false)

                            useStore.setState({ fullscreenLoadingModalVisible: false })

                            showToast({ message: i18n(lang, "folderRenamed") })
                        }).catch((err) => {
                            setButtonsDisabled(false)

                            useStore.setState({ fullscreenLoadingModalVisible: false })

                            showToast({ message: err.toString() })
                        })
                    }).catch((err) => {
                        setButtonsDisabled(false)

                        useStore.setState({ fullscreenLoadingModalVisible: false })

                        showToast({ message: err.toString() })
                    })
                }
                else{
                    if(!fileAndFolderNameValidation(name)){
                        setButtonsDisabled(false)

                        useStore.setState({ fullscreenLoadingModalVisible: false })
    
                        return showToast({ message: i18n(lang, "invalidFileName") })
                    }

                    fileExists({ name, parent: item.parent }).then((res) => {
                        if(res.exists){
                            if(item.uuid !== res.existsUUID){
                                setButtonsDisabled(false)

                                useStore.setState({ fullscreenLoadingModalVisible: false })
    
                                return showToast({ message: i18n(lang, "alreadyExistsInThisFolder", true, ["__NAME__"], [name]) })
                            }
                        }

                        renameFile({ file: item, name }).then(async () => {
                            DeviceEventEmitter.emit("event", {
                                type: "change-item-name",
                                data: {
                                    uuid: item.uuid,
                                    name
                                }
                            })

                            setButtonsDisabled(false)

                            useStore.setState({ fullscreenLoadingModalVisible: false })

                            showToast({ message: i18n(lang, "fileRenamed") })
                        }).catch((err) => {
                            setButtonsDisabled(false)

                            useStore.setState({ fullscreenLoadingModalVisible: false })

                            showToast({ message: err.toString() })
                        })
                    }).catch((err) => {
                        setButtonsDisabled(false)

                        useStore.setState({ fullscreenLoadingModalVisible: false })

                        showToast({ message: err.toString() })
                    })
                }
            }} />
        </Dialog.Container>
    )
}

export const CreateFolderDialog = () => {
    const [darkMode, setDarkMode] = useMMKVBoolean("darkMode", storage)
    const createFolderDialogVisible = useStore(state => state.createFolderDialogVisible)
    const setCreateFolderDialogVisible = useStore(state => state.setCreateFolderDialogVisible)
    const [value, setValue] = useState("Untitled folder")
    const inputRef = useRef()
    const [buttonsDisabled, setButtonsDisabled] = useState(false)
    const [lang, setLang] = useMMKVString("lang", storage)

    useEffect(() => {
        setButtonsDisabled(false)

        if(!createFolderDialogVisible){
            setTimeout(() => {
                setValue("Untitled folder")
            }, 250)
        }

        if(createFolderDialogVisible){
            setTimeout(() => {
                inputRef.current.focus()
                inputRef.current.setNativeProps({ selection: { start: value.length, end: value.length } })
            }, 250)
        }
    }, [createFolderDialogVisible])

    return (
        <Dialog.Container
            visible={createFolderDialogVisible}
            useNativeDriver={false}
            onRequestClose={() => setCreateFolderDialogVisible(false)}
            onBackdropPress={() => {
                if(!buttonsDisabled){
                    setCreateFolderDialogVisible(false)
                }
            }}
        >
            <Dialog.Title>{i18n(lang, "newFolder")}</Dialog.Title>
            <Dialog.Input placeholder={i18n(lang, "folderName")} value={value} selection={{ start: value.length, end: value.length }} autoFocus={true} onChangeText={(val) => setValue(val)} textInputRef={inputRef} />
            <Dialog.Button label={i18n(lang, "cancel")} disabled={buttonsDisabled} onPress={() => setCreateFolderDialogVisible(false)} />
            <Dialog.Button label={i18n(lang, "create")} disabled={buttonsDisabled} onPress={() => {
                setButtonsDisabled(true)
                setCreateFolderDialogVisible(false)

                useStore.setState({ fullscreenLoadingModalVisible: true })

                const parent = getParent()
                const name = value.trim()

                folderExists({
                    name,
                    parent
                }).then((res) => {
                    if(res.exists){
                        setButtonsDisabled(false)

                        useStore.setState({ fullscreenLoadingModalVisible: false })

                        return showToast({ message: i18n(lang, "alreadyExistsInThisFolder", true, ["__NAME__"], [name]) })
                    }

                    createFolder({
                        name,
                        parent
                    }).then(async () => {
                        DeviceEventEmitter.emit("event", {
                            type: "reload-list",
                            data: {
                                parent
                            }
                        })

                        setButtonsDisabled(false)

                        useStore.setState({ fullscreenLoadingModalVisible: false })

                        showToast({ message: i18n(lang, "folderCreated", true, ["__NAME__"], [name]) })
                    }).catch((err) => {
                        setButtonsDisabled(false)

                        useStore.setState({ fullscreenLoadingModalVisible: false })

                        showToast({ message: err.toString() })
                    })
                }).catch((err) => {
                    setButtonsDisabled(false)

                    useStore.setState({ fullscreenLoadingModalVisible: false })

                    showToast({ message: err.toString() })
                })
            }} />
        </Dialog.Container>
    )
}

export const ConfirmPermanentDeleteDialog = () => {
    const [darkMode, setDarkMode] = useMMKVBoolean("darkMode", storage)
    const confirmPermanentDeleteDialogVisible = useStore(state => state.confirmPermanentDeleteDialogVisible)
    const setConfirmPermanentDeleteDialogVisible = useStore(state => state.setConfirmPermanentDeleteDialogVisible)
    const [buttonsDisabled, setButtonsDisabled] = useState(false)
    const [lang, setLang] = useMMKVString("lang", storage)
    const currentActionSheetItem = useStore(state => state.currentActionSheetItem)

    useEffect(() => {
        setButtonsDisabled(false)
    }, [confirmPermanentDeleteDialogVisible])

    return (
        <>
            {
                typeof currentActionSheetItem !== "undefined" && (
                    <Dialog.Container
                        visible={confirmPermanentDeleteDialogVisible}
                        useNativeDriver={false}
                        onRequestClose={() => setConfirmPermanentDeleteDialogVisible(false)}
                        onBackdropPress={() => setConfirmPermanentDeleteDialogVisible(false)}
                    >
                        <Dialog.Title>{i18n(lang, "itemDeletedPermanentlyConfirmation", true, ["__NAME__"], [currentActionSheetItem.name])}</Dialog.Title>
                        <Dialog.Button label={i18n(lang, "cancel")} disabled={buttonsDisabled} onPress={() => setConfirmPermanentDeleteDialogVisible(false)} />
                        <Dialog.Button label={i18n(lang, "deletePermanently")} disabled={buttonsDisabled} onPress={() => {
                            setButtonsDisabled(true)
                            setConfirmPermanentDeleteDialogVisible(false)

                            useStore.setState({ fullscreenLoadingModalVisible: true })

                            console.log(currentActionSheetItem)

                            deleteItemPermanently({ item: currentActionSheetItem }).then(async () => {
                                DeviceEventEmitter.emit("event", {
                                    type: "remove-item",
                                    data: {
                                        uuid: currentActionSheetItem.uuid
                                    }
                                })

                                setButtonsDisabled(false)

                                useStore.setState({ fullscreenLoadingModalVisible: false })

                                showToast({ message: i18n(lang, "itemDeletedPermanently", true, ["__NAME__"], [currentActionSheetItem.name]) })
                            }).catch((err) => {
                                setButtonsDisabled(false)

                                useStore.setState({ fullscreenLoadingModalVisible: false })

                                showToast({ message: err.toString() })
                            })
                        }} />
                    </Dialog.Container>
                )
            }
        </>
    )
}

export const ConfirmRemoveFromSharedInDialog = () => {
    const [darkMode, setDarkMode] = useMMKVBoolean("darkMode", storage)
    const removeFromSharedInDialogVisible = useStore(state => state.removeFromSharedInDialogVisible)
    const setRemoveFromSharedInDialogVisible = useStore(state => state.setRemoveFromSharedInDialogVisible)
    const [buttonsDisabled, setButtonsDisabled] = useState(false)
    const [lang, setLang] = useMMKVString("lang", storage)
    const currentActionSheetItem = useStore(state => state.currentActionSheetItem)

    useEffect(() => {
        setButtonsDisabled(false)
    }, [removeFromSharedInDialogVisible])

    return (
        <>
            {
                typeof currentActionSheetItem !== "undefined" && (
                    <Dialog.Container
                        visible={removeFromSharedInDialogVisible}
                        useNativeDriver={false}
                        onRequestClose={() => setRemoveFromSharedInDialogVisible(false)}
                        onBackdropPress={() => setRemoveFromSharedInDialogVisible(false)}
                    >
                        <Dialog.Title>{i18n(lang, "removeFromSharedInConfirmation", true, ["__NAME__"], [currentActionSheetItem.name])}</Dialog.Title>
                        <Dialog.Button label={i18n(lang, "cancel")} disabled={buttonsDisabled} onPress={() => setRemoveFromSharedInDialogVisible(false)} />
                        <Dialog.Button label={i18n(lang, "removeFromSharedIn")} disabled={buttonsDisabled} onPress={() => {
                            setButtonsDisabled(true)
                            setRemoveFromSharedInDialogVisible(false)

                            useStore.setState({ fullscreenLoadingModalVisible: true })

                            removeSharedInItem({ item: currentActionSheetItem }).then(async () => {
                                DeviceEventEmitter.emit("event", {
                                    type: "remove-item",
                                    data: {
                                        uuid: currentActionSheetItem.uuid
                                    }
                                })

                                setButtonsDisabled(false)

                                useStore.setState({ fullscreenLoadingModalVisible: false })

                                showToast({ message: i18n(lang, "removedFromSharedIn", true, ["__NAME__"], [currentActionSheetItem.name]) })
                            }).catch((err) => {
                                setButtonsDisabled(false)

                                useStore.setState({ fullscreenLoadingModalVisible: false })

                                showToast({ message: err.toString() })
                            })
                        }} />
                    </Dialog.Container>
                )
            }
        </>
    )
}

export const ConfirmStopSharingDialog = () => {
    const [darkMode, setDarkMode] = useMMKVBoolean("darkMode", storage)
    const stopSharingDialogVisible = useStore(state => state.stopSharingDialogVisible)
    const setStopSharingDialogVisible = useStore(state => state.setStopSharingDialogVisible)
    const [buttonsDisabled, setButtonsDisabled] = useState(false)
    const [lang, setLang] = useMMKVString("lang", storage)
    const currentActionSheetItem = useStore(state => state.currentActionSheetItem)

    useEffect(() => {
        setButtonsDisabled(false)
    }, [stopSharingDialogVisible])

    return (
        <>
            {
                typeof currentActionSheetItem !== "undefined" && (
                    <Dialog.Container
                        visible={stopSharingDialogVisible}
                        useNativeDriver={false}
                        onRequestClose={() => setStopSharingDialogVisible(false)}
                        onBackdropPress={() => setStopSharingDialogVisible(false)}
                    >
                        <Dialog.Title>{i18n(lang, "stopSharingConfirmation", true, ["__NAME__"], [currentActionSheetItem.name])}</Dialog.Title>
                        <Dialog.Button label={i18n(lang, "cancel")} disabled={buttonsDisabled} onPress={() => setStopSharingDialogVisible(false)} />
                        <Dialog.Button label={i18n(lang, "stopSharing")} disabled={buttonsDisabled} onPress={() => {
                            setButtonsDisabled(true)
                            setStopSharingDialogVisible(false)

                            useStore.setState({ fullscreenLoadingModalVisible: true })

                            stopSharingItem({ item: currentActionSheetItem }).then(async () => {
                                DeviceEventEmitter.emit("event", {
                                    type: "remove-item",
                                    data: {
                                        uuid: currentActionSheetItem.uuid
                                    }
                                })

                                setButtonsDisabled(false)

                                useStore.setState({ fullscreenLoadingModalVisible: false })

                                showToast({ message: i18n(lang, "stoppedSharingItem", true, ["__NAME__"], [currentActionSheetItem.name]) })
                            }).catch((err) => {
                                setButtonsDisabled(false)

                                useStore.setState({ fullscreenLoadingModalVisible: false })

                                showToast({ message: err.toString() })
                            })
                        }} />
                    </Dialog.Container>
                )
            }
        </>
    )
}

export const CreateTextFileDialog = () => {
    const [darkMode, setDarkMode] = useMMKVBoolean("darkMode", storage)
    const createTextFileDialogVisible = useStore(state => state.createTextFileDialogVisible)
    const setCreateTextFileDialogVisible = useStore(state => state.setCreateTextFileDialogVisible)
    const [value, setValue] = useState(".txt")
    const inputRef = useRef()
    const [lang, setLang] = useMMKVString("lang", storage)
    const setTextEditorModalVisible = useStore(state => state.setTextEditorModalVisible)
	const setTextEditorState = useStore(state => state.setTextEditorState)
	const setTextEditorText = useStore(state => state.setTextEditorText)
    const setCreateTextFileDialogName = useStore(state => state.setCreateTextFileDialogName)
    const setTextEditorParent = useStore(state => state.setTextEditorParent)

    useEffect(() => {
        if(!createTextFileDialogVisible){
            setTimeout(() => {
                setValue(".txt")
            }, 250)
        }

        if(createTextFileDialogVisible){
            setTimeout(() => {
                inputRef.current.focus()
                inputRef.current.setNativeProps({ selection: { start: 0, end: 0 } })
            }, 250)
        }
    }, [createTextFileDialogVisible])

    return (
        <Dialog.Container
            visible={createTextFileDialogVisible}
            useNativeDriver={false}
            onRequestClose={() => setCreateTextFileDialogVisible(false)}
            onBackdropPress={() => {
                setCreateTextFileDialogVisible(false)
            }}
        >
            <Dialog.Title>{i18n(lang, "createTextFile")}</Dialog.Title>
            <Dialog.Input placeholder={i18n(lang, "fileName")} value={value} selection={{ start: 0, end: 0 }} autoFocus={true} onChangeText={(val) => setValue(val)} textInputRef={inputRef} />
            <Dialog.Button label={i18n(lang, "cancel")} onPress={() => setCreateTextFileDialogVisible(false)} />
            <Dialog.Button label={i18n(lang, "create")} onPress={() => {
                if(value.length == 0){
                    return false
                }

                setCreateTextFileDialogVisible(false)
                setCreateTextFileDialogName(value)
                setTextEditorText("")
                setTextEditorParent("")
                setTextEditorState("new")
                setTextEditorModalVisible(true)
            }} />
        </Dialog.Container>
    )
}