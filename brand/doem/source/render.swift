import AppKit
let root = CommandLine.arguments[1]
func render(_ size: Int, _ colour: NSColor, _ icon: Bool, _ file: String) {
 let rep = NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:size,pixelsHigh:size,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
 NSGraphicsContext.saveGraphicsState()
 NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep:rep)
 let flip=AffineTransform(translationByX:0,byY:CGFloat(size)); (flip as NSAffineTransform).concat()
 let scale=AffineTransform(scaleByX:CGFloat(size)/1024,byY:-CGFloat(size)/1024); (scale as NSAffineTransform).concat()
 if icon { NSColor(srgbRed:74/255,green:74/255,blue:232/255,alpha:1).setFill(); NSBezierPath(roundedRect:NSRect(x:80,y:80,width:864,height:864),xRadius:192,yRadius:192).fill() }
 let pos = icon ? AffineTransform(translationByX:227,byY:205) : AffineTransform(translationByX:0,byY:0);(pos as NSAffineTransform).concat()
 let s = icon ? 2.7 : 1024.0/220.0
 (AffineTransform(scaleByX:s,byY:s) as NSAffineTransform).concat()
 let path=NSBezierPath()
path.move(to: NSPoint(x:150,y:22))
path.curve(to:NSPoint(x:172,y:4),controlPoint1:NSPoint(x:150,y:10),controlPoint2:NSPoint(x:158,y:4))
path.curve(to:NSPoint(x:194,y:22),controlPoint1:NSPoint(x:186,y:4),controlPoint2:NSPoint(x:194,y:10))
path.line(to: NSPoint(x:194,y:126))
path.curve(to:NSPoint(x:118,y:204),controlPoint1:NSPoint(x:194,y:176),controlPoint2:NSPoint(x:165,y:204))
path.line(to: NSPoint(x:28,y:204))
path.curve(to:NSPoint(x:10,y:186),controlPoint1:NSPoint(x:16,y:204),controlPoint2:NSPoint(x:10,y:197))
path.curve(to:NSPoint(x:28,y:168),controlPoint1:NSPoint(x:10,y:175),controlPoint2:NSPoint(x:17,y:168))
path.line(to: NSPoint(x:110,y:168))
path.curve(to:NSPoint(x:153,y:133),controlPoint1:NSPoint(x:139,y:168),controlPoint2:NSPoint(x:153,y:151))
path.curve(to:NSPoint(x:110,y:98),controlPoint1:NSPoint(x:153,y:114),controlPoint2:NSPoint(x:137,y:98))
path.line(to: NSPoint(x:30,y:98))
path.curve(to:NSPoint(x:12,y:80),controlPoint1:NSPoint(x:18,y:98),controlPoint2:NSPoint(x:12,y:91))
path.curve(to:NSPoint(x:30,y:62),controlPoint1:NSPoint(x:12,y:69),controlPoint2:NSPoint(x:19,y:62))
path.line(to: NSPoint(x:125,y:62))
path.curve(to:NSPoint(x:150,y:69),controlPoint1:NSPoint(x:135,y:62),controlPoint2:NSPoint(x:143,y:64))
path.close()
path.move(to: NSPoint(x:27,y:114))
path.line(to: NSPoint(x:102,y:114))
path.curve(to:NSPoint(x:121,y:131),controlPoint1:NSPoint(x:114,y:114),controlPoint2:NSPoint(x:121,y:121))
path.curve(to:NSPoint(x:102,y:148),controlPoint1:NSPoint(x:121,y:141),controlPoint2:NSPoint(x:114,y:148))
path.line(to: NSPoint(x:27,y:148))
path.curve(to:NSPoint(x:8,y:131),controlPoint1:NSPoint(x:15,y:148),controlPoint2:NSPoint(x:8,y:141))
path.curve(to:NSPoint(x:27,y:114),controlPoint1:NSPoint(x:8,y:121),controlPoint2:NSPoint(x:15,y:114))
path.close()
 colour.setFill();path.fill()
 NSGraphicsContext.restoreGraphicsState()
 try! rep.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:root+"/"+file))
}
let indigo=NSColor(srgbRed:74/255,green:74/255,blue:232/255,alpha:1)
for size in [16,32,64,128,256,512,1024] {
 render(size,indigo,false,"png/doem-mark-indigo-\(size).png")
 render(size,.white,false,"png/doem-mark-white-\(size).png")
 render(size,.black,false,"png/doem-mark-template-\(size).png")
 render(size,.white,true,"png/doem-app-\(size).png")
}
for size in [16,32,128,256,512] {
 render(size,.white,true,"macos/Doem.iconset/icon_\(size)x\(size).png")
 render(size*2,.white,true,"macos/Doem.iconset/icon_\(size)x\(size)@2x.png")
}
