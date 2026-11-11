---
'@astryxdesign/core': patch
---

[fix] BottomSheet: on a touch screen, a swipe that starts slowly on a sheet whose content fits now moves the sheet, so a slow swipe down can close it. Before, when the finger's first move was 8 px or less, in either direction, the sheet stopped answering that swipe: it stayed open, or moved a few pixels and fell back. Fast swipes and swipes on the grab bar already worked. The fix applies wherever the touched content has nothing to scroll: a sheet whose content fits, and the fixed header or footer around a list. That includes the PowerSearch and Tokenizer sheets. A list that scrolls keeps its behavior.

@imdreamrunner
