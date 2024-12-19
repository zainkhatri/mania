// Views/Welcome/WelcomeView.swift
import SwiftUI

struct WelcomeView: View {
    @Binding var selectedTab: Int // Add binding for the selected tab
    
    var body: some View {
        ScrollView {
            VStack(spacing: 35) {
                Text("Welcome")
                    .font(.custom("Zain-Regular", size: 85))
                    .kerning(-2.3)
                    .foregroundColor(.black)
                
                VStack(spacing: 25) {
                    Text("to your")
                        .font(.custom("Zain-Regular", size: 55))
                        .kerning(-1.8)
                        .foregroundColor(.gray)
                    
                    Text("JOURNAL")
                        .font(.custom("Zain-Regular", size: 70))
                        .kerning(-2.0)
                        .foregroundColor(.black)
                }
                
                Text("Write about your day! Add whatever pictures you like and I'll format it for you. Select 'New Entry' to get started.")
                    .font(.custom("Zain-Regular", size: 40))
                    .kerning(-1.5)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
                    .foregroundColor(.gray)
                
                Button(action: {
                    selectedTab = 2 // Switch to the "New Entry" tab
                }) {
                    VStack {
                        Text("NEW")
                            .font(.custom("Zain-Regular", size: 45))
                            .kerning(-1.5)
                        Text("entry")
                            .font(.custom("Zain-Regular", size: 35))
                            .kerning(-1)
                    }
                    .foregroundColor(.black)
                    .padding()
                    .background(Color.black.opacity(0.05))
                    .cornerRadius(10)
                }
                .padding(.top, 20)
            }
            .padding(.vertical, 40)
            .padding(.horizontal)
        }
    }
}
