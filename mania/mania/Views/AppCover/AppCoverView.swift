// Views/AppCover/AppCoverView.swift
import SwiftUI

struct AppCoverView: View {
    @Binding var isFirstLaunch: Bool
    
    var body: some View {
        VStack(spacing: 30) {
            Text("MANIA")
                .font(.custom("Zain-Regular", size: 92))
                .kerning(-2.3)
                .foregroundColor(.black)
            
            Text("by zain")
                .font(.custom("Zain-Regular", size: 65))  // Increased from 36
                .kerning(-1.8)
                .foregroundColor(.gray)
            
            Text("Welcome to my app! Thanks for coming. This app serves as a journaling app that automatically formats your journal into my journal style. I'll prompt you to add the date, a title, and then add whatever you want to write along with some pictures, and I'll have my app format it for you. I'll make you a collage, I'll color the title, and I'll format the writing so it fits just like my journals. Have fun!")
                .font(.custom("Zain-Regular", size: 35))  // Increased from 24
                .kerning(-1.5)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            
            Button(action: {
                withAnimation {
                    isFirstLaunch = false
                }
            }) {
                Text("Start journaling!")
                    .font(.custom("Zain-Regular", size: 45))  // Increased from 28
                    .kerning(-1)
                    .foregroundColor(.black)
                    .cornerRadius(12)
            }
        }
        .padding()
    }
}
