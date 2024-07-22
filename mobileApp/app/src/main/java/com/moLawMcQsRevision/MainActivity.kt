package com.moLawMcQsRevision

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.material3.Button
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moLawMcQsRevision.ui.theme.MOLawMCQRevisionTheme

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    setContent {
      MOLawMCQRevisionTheme {
        MainContainer(Modifier)
      }
    }
  }
}

@Composable
fun MainContainer(modifier: Modifier = Modifier) {
  var currentPage by remember {
    mutableStateOf(1)
  }
  Scaffold(
    modifier = modifier.fillMaxSize(),
    contentColor = Color.Black,
    containerColor = Color.White,
    topBar = {
      Text(
        text = stringResource(R.string.app_title_in_top_bar)
      )
    },
    bottomBar = {
      Text(
        text = "廣告",
        modifier = modifier.fillMaxWidth(),
        textAlign = TextAlign.Center)
    }
  ) { innerPadding ->
    BackgroundImage(modifier)
    when (currentPage) {
      1 -> MenuPageContainer(modifier.padding(innerPadding)) { currentPage = 2 }
      2-> LawQsPageContainer(modifier.padding(innerPadding))
    }
  }
}

@Composable
fun MenuPageContainer(modifier: Modifier = Modifier, switchPage: () -> Unit = {}) {
  Box(
    modifier = modifier
      .fillMaxSize()
      .wrapContentSize(Alignment.Center)
  ) {
    Column(
      modifier = modifier,
      horizontalAlignment = Alignment.CenterHorizontally
    ) {
      ReviewModeButton(
        stringResource(R.string.revision_mode1),
        {},
        modifier
      )
      ReviewModeButton(
        stringResource(R.string.revision_mode2),
        {
          val qsIndex = (1..6).random()
        //The mutableStateOf() function returns an observable
        //var result by remember { mutableStateOf(1) }
          switchPage()
        },
        modifier
      )
      ReviewModeButton(
        stringResource(R.string.revision_mode3),
        {},
        modifier
      )

    }
  }

}

@Composable
fun ReviewModeButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
  Button(
    modifier = modifier.padding(vertical = 5.dp),
    onClick = onClick
  ) {
    Text(text)
  }
}

@Composable
fun LawQsPageContainer(modifier: Modifier = Modifier) {
  Scaffold(modifier = modifier.fillMaxSize(),
    topBar = {
      LawTitle(
        name = "《中華人民共和國憲法》",
        modifier = modifier
      )
    },
    containerColor = Color.Transparent
  ) { innerPadding ->
    Column (
      modifier = modifier.padding(15.dp)
    ) {
      LawQs(
        qs = "1) 中華人民共和國現行憲法於哪一年通過？",
        modifier = modifier.padding(innerPadding)
      )
      LawMCOption(
        options = arrayOf(
          "A. 1954年",
          "B. 1975年",
          "C. 1978年",
          "D. 1982年"
        ),
        modifier = modifier
      )
      ResultText(true, modifier)
    }
  }
}

@Composable
fun LawTitle(name: String, modifier: Modifier = Modifier) {
  Box(modifier = modifier) {
    Text(
      text = name,
      fontSize = 20.sp,
      lineHeight = 25.sp,
      textAlign = TextAlign.Center
    )
  }
}

@Composable
fun LawQs(qs: String, modifier: Modifier = Modifier) {
  Box (
    modifier = modifier,
  ) {
    Text(
      text = qs,
      color = Color.Blue,
      fontSize = 15.sp,
      lineHeight = 20.sp
    )
  }
}

@Composable
fun LawMCOption(options: Array<String>, modifier: Modifier = Modifier) {
  Box (
    modifier = modifier,
  ) {
    Column {
      for (option in options) {
        Text(
          text = option,
          fontSize = 15.sp,
          lineHeight = 20.sp
        )
      }
    }
  }
}

@Composable
fun BackgroundImage(modifier: Modifier = Modifier) {
  val photo = painterResource(R.drawable.background)
  Image(
    painter = photo,
    contentDescription = "using white painted wall as background image",
    modifier = modifier.fillMaxSize(),
    contentScale = ContentScale.FillBounds,
    alpha = 0.5F
  )
}

@Composable
fun ResultText(isCorrect: Boolean? = null, modifier: Modifier = Modifier) {
  var resultText = ""
  var resultColor : Color
  if (isCorrect != null) {
    if (isCorrect == true) {
      resultText = stringResource(R.string.correct_result_text)
      resultColor = Color(0xFF4CAF50)
    } else {
      resultText = "答錯了"
      resultColor = Color.Red
    }
    Text(
      text = resultText,
      color = resultColor,
      fontWeight = FontWeight.Bold,
      modifier = modifier.padding(vertical = 10.dp)
    )
  }
}

@Preview(showBackground = true)
@Composable
fun GreetingPreview() {
  MOLawMCQRevisionTheme {
    MainContainer(Modifier)
  }
}