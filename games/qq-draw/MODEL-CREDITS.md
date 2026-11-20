# QQ Draw recognition model credits

QQ Draw can load a browser-side QuickDraw sketch classifier from the version-pinned public model repository:

- Model and inference reference: https://github.com/jinnyday0719/quickdraw-resnet
- Model source revision: `bb1d600a7b2139e0f36cb199eac8ab30dda71e4f`
- Model source code license: MIT (see the source repository's LICENSE)
- Training data family: Google's Quick, Draw! dataset; dataset terms and attribution are documented at https://github.com/googlecreativelab/quickdraw-dataset

The model is downloaded by the browser on first use. It runs locally in the page after download; the drawing strokes are not sent to the model repository. If model loading fails, QQ Draw falls back to its small offline geometry recognizer.
