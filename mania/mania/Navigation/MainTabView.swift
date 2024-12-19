// Navigation/MainTabView.swift
import SwiftUI

struct MainTabView: View {
    @State private var selectedTab: Int = 0 // Track the active tab

    var body: some View {
        TabView(selection: $selectedTab) {
            WelcomeView(selectedTab: $selectedTab) // Pass binding to WelcomeView
                .tabItem {
                    Image(systemName: "house.fill")
                    Text("Welcome")
                        .font(.custom("Zain-Regular", size: 12))
                        .kerning(-0.5)
                }
                .tag(0) // Assign a tag for the Welcome tab
            
            HomeView()
                .tabItem {
                    Image(systemName: "book.fill")
                    Text("Journal")
                        .font(.custom("Zain-Regular", size: 12))
                        .kerning(-0.5)
                }
                .tag(1) // Assign a tag for the Journal tab
            
            CreateJournalView()
                .tabItem {
                    Image(systemName: "plus.circle.fill")
                    Text("New Entry")
                        .font(.custom("Zain-Regular", size: 12))
                        .kerning(-0.5)
                }
                .tag(2) // Assign a tag for the New Entry tab
            
            SettingsView()
                .tabItem {
                    Image(systemName: "gearshape.fill")
                    Text("Settings")
                        .font(.custom("Zain-Regular", size: 12))
                        .kerning(-0.5)
                }
                .tag(3) // Assign a tag for the Settings tab
        }
        .tint(.black)
    }
}
