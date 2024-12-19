//
//  SettingsView.swift
//  mania
//
//  Created by Zain Khatri on 12/11/24.
//
import SwiftUI 

// Views/Settings/SettingsView.swift
struct SettingsView: View {
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Text("Settings")
                    .font(.custom("Zain-Regular", size: 36))
                    .kerning(-2)
                    .padding(.top)
                
                List {
                    Section {
                        Button(action: {
                            // Add notification settings
                        }) {
                            SettingRow(title: "Notifications", icon: "bell.fill")
                        }
                        
                        Button(action: {
                            // Add theme settings
                        }) {
                            SettingRow(title: "Appearance", icon: "paintbrush.fill")
                        }
                        
                        Button(action: {
                            // Add backup settings
                        }) {
                            SettingRow(title: "Backup", icon: "arrow.clockwise")
                        }
                    }
                    
                    Section {
                        Button(action: {
                            // Add about action
                        }) {
                            SettingRow(title: "About", icon: "info.circle.fill")
                        }
                        
                        Button(action: {
                            // Add help action
                        }) {
                            SettingRow(title: "Help", icon: "questionmark.circle.fill")
                        }
                    }
                }
                .listStyle(InsetGroupedListStyle())
            }
        }
    }
}
