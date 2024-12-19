// App/ContentView.swift
import SwiftUI
import CoreText

struct ContentView: View {
    @AppStorage("isFirstLaunch") private var isFirstLaunch = true
    @State private var fontLoaded = false
    
    init() {
        registerCustomFont()
    }
    
    var body: some View {
        if isFirstLaunch {
            AppCoverView(isFirstLaunch: $isFirstLaunch)
        } else {
            MainTabView()
        }
    }
}

// Modern font registration
private func registerCustomFont() {
    let fontName = "Zain-Regular"
    let fontExtension = "ttf"
    
    // Check if font is already registered
    if let _ = UIFont(name: fontName, size: 12) {
        print("Font already registered")
        return
    }
    
    guard let fontURL = Bundle.main.url(forResource: fontName, withExtension: fontExtension) else {
        print("Failed to find font \(fontName).\(fontExtension)")
        return
    }
    
    var error: Unmanaged<CFError>?
    guard CTFontManagerRegisterFontsForURL(fontURL as CFURL, .process, &error) else {
        print("Failed to register font: \(error?.takeRetainedValue().localizedDescription ?? "")")
        return
    }
    
    print("Successfully registered font \(fontName)")
}
