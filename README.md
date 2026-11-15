# Frame Workstation

面向 Apple Silicon macOS 的本地视频工具。第一阶段支持导入、预览、裁剪、0.5–2 倍变速，以及 MP4、MOV、WebM 导出；可选择分辨率和压缩质量。低于目标分辨率的视频不会被放大。

```sh
npm install
npm rebuild electron ffmpeg-static  # 如果安装中断或 npm 跳过了安装脚本
npm start
npm test
npm run dist
```

导出使用随应用打包的 `ffmpeg-static` 二进制，源视频不会被覆盖。预览支持情况取决于 Electron 内置解码器；无法预览的素材需要先转换为兼容格式。导出时请勿关闭应用。发布应用前需核查 FFmpeg 及其编解码器、Electron 和依赖的许可证，并完成 macOS 签名和公证。

后续阶段：本地 Whisper/Piper 与 OpenAI 字幕配音、Remotion 图文和数据模板，以及 OpenAI、DeepSeek、通义千问和自定义兼容接口的内容生成。

## 项目文档

- [项目结构](docs/项目结构.md)
- [功能文档](docs/功能文档.md)
- [项目规划](docs/项目规划.md)

Electron 和 FFmpeg 已在当前环境安装，可运行 `npm start`。如果下载中断，ffmpeg-static 可能留下不完整文件；需移走该文件后重新执行 `npm rebuild ffmpeg-static`。原分辨率下，奇数宽或高会缩小 1 像素以满足 H.264 编码要求。

目前支持播放进度、单轨片段拆分/删除、按保留片段拼接导出，以及 MP4、MOV、WebM 和无声 GIF；支持导入、手动编辑并保存 SRT；支持将 SRT 字幕烧录到视频或 GIF；已接入本地 whisper.cpp 和 OpenAI 字幕识别原型（需要本地程序及模型或云端密钥，尚未实测）；配音已接入 Piper 与 OpenAI 原型，须自备 Piper 程序及模型或 OpenAI 密钥；尚未经过真实服务和模型验收。Remotion 模板尚未实现。当前 FFmpeg 构建启用了 `--enable-nonfree`，不能用于再分发；`npm run dist` 会被检查阻止，须先替换为可再分发的构建并完成许可证核查。
