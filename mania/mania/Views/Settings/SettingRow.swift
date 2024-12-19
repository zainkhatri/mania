//
//  SettingRow.swift
//  mania
//
//  Created by Zain Khatri on 12/11/24.
//
import SwiftUI 

// Views/Settings/Components/SettingRow.swift
struct SettingRow: View {
    let title: String
    let icon: String
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(.black)
                .frame(width: 24, height: 24)
            
            Text(title)
                .font(.custom("Zain-Regular", size: 18))
                .kerning(-1)
                .foregroundColor(.black)
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .foregroundColor(.gray)
                .font(.system(size: 14))
        }
    }
}
